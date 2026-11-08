// SPDX-License-Identifier: GPL-2.0-or-later
// The screensaver: Orrery.scr /s shows the "dream" page on every screen
// until the user touches anything; Orrery.scr /p <hwnd> draws in the little
// monitor of the Screen Saver Settings dialog.
//
// The pages' input goes to windows of the msedgewebview2 process, which
// WinForms never sees, so /s watches the keyboard and the mouse with
// low-level hooks (and polls the cursor, which SetCursorPos moves without
// a hook event).
//
// ORRERY_EXIT_AFTER=<seconds> closes /s and /p after that long: for tests.

using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace Orrery;

public static class ScreenSaver
{
    const string MutexName = @"Local\Orrery.ScreenSaver";
    const int GraceMs = 400;        // input ignored while the windows come up
    const int MoveSlop = 12;        // pixels the mouse may drift

    static readonly List<SaverForm> forms = [];
    static ApplicationContext? context;
    static IntPtr keyboardHook, mouseHook;
    static NativeMethods.HookProc? keyboardProc, mouseProc;    // kept alive for the hooks
    static long startTicks;
    static Point startCursor;
    static bool quitting;

    public static int Run()
    {
        using var mutex = new Mutex(true, MutexName, out var first);
        if (!first)
        {
            Log.Write("screensaver: already running");
            return 0;
        }

        startTicks = Environment.TickCount64;
        NativeMethods.GetCursorPos(out startCursor);
        Cursor.Hide();

        context = new ApplicationContext();
        foreach (var screen in Screen.AllScreens)
        {
            var form = new SaverForm(screen);
            forms.Add(form);
            form.Show();        // black at once; the page comes later
        }
        forms.FirstOrDefault(f => f.IsPrimary)?.Activate();

        keyboardProc = KeyboardHook;
        mouseProc = MouseHook;
        var module = NativeMethods.GetModuleHandle(null);
        keyboardHook = NativeMethods.SetWindowsHookEx(NativeMethods.WH_KEYBOARD_LL, keyboardProc, module, 0);
        mouseHook = NativeMethods.SetWindowsHookEx(NativeMethods.WH_MOUSE_LL, mouseProc, module, 0);
        if (keyboardHook == IntPtr.Zero || mouseHook == IntPtr.Zero)
            Log.Write($"screensaver: input hook failed ({Marshal.GetLastWin32Error()})");

        // The hooks can be dropped by Windows if the thread is ever slow,
        // and SetCursorPos makes no hook event: poll the cursor as well.
        var poll = new System.Windows.Forms.Timer { Interval = 100 };
        poll.Tick += (_, _) =>
        {
            if (NativeMethods.GetCursorPos(out var p))
                Moved(p);
        };
        poll.Start();

        ExitAfter(Quit);
        SystemEvents.DisplaySettingsChanged += OnDisplayChanged;
        try
        {
            Application.Run(context);
        }
        finally
        {
            SystemEvents.DisplaySettingsChanged -= OnDisplayChanged;
            poll.Dispose();
            Unhook();
            Cursor.Show();
        }
        return 0;
    }

    static bool InGrace => Environment.TickCount64 - startTicks < GraceMs;

    static void Moved(Point p)
    {
        if (quitting)
            return;
        if (InGrace)
        {
            startCursor = p;    // a mouse still settling is not the user
            return;
        }
        if (Math.Abs(p.X - startCursor.X) > MoveSlop || Math.Abs(p.Y - startCursor.Y) > MoveSlop)
            Dismiss("mouse move");
    }

    static IntPtr KeyboardHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0 && !InGrace)
        {
            var msg = (int)wParam;
            if (msg is NativeMethods.WM_KEYDOWN or NativeMethods.WM_SYSKEYDOWN)
                Dismiss("key");
        }
        return NativeMethods.CallNextHookEx(IntPtr.Zero, code, wParam, lParam);
    }

    static IntPtr MouseHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            switch ((int)wParam)
            {
            case NativeMethods.WM_MOUSEMOVE:
                var info = Marshal.PtrToStructure<NativeMethods.MSLLHOOKSTRUCT>(lParam);
                Moved(new Point(info.pt.X, info.pt.Y));
                break;
            case NativeMethods.WM_LBUTTONDOWN or NativeMethods.WM_RBUTTONDOWN or NativeMethods.WM_MBUTTONDOWN
                or NativeMethods.WM_XBUTTONDOWN or NativeMethods.WM_MOUSEWHEEL or NativeMethods.WM_MOUSEHWHEEL:
                if (!InGrace)
                    Dismiss("mouse button");
                break;
            }
        }
        return NativeMethods.CallNextHookEx(IntPtr.Zero, code, wParam, lParam);
    }

    // From a hook: leave it at once, and close the windows afterwards.
    static void Dismiss(string why)
    {
        if (quitting)
            return;
        quitting = true;
        Log.Write($"screensaver: {why}");
        Unhook();
        var form = forms.FirstOrDefault(f => f.IsHandleCreated);
        if (form != null)
            form.BeginInvoke(Quit);
        else
            Quit();
    }

    static void Quit()
    {
        if (quitting && context == null)
            return;
        quitting = true;
        Unhook();
        foreach (var form in forms.ToArray())
            form.Close();
        forms.Clear();
        context?.ExitThread();
        context = null;
    }

    static void Unhook()
    {
        if (keyboardHook != IntPtr.Zero)
            NativeMethods.UnhookWindowsHookEx(keyboardHook);
        if (mouseHook != IntPtr.Zero)
            NativeMethods.UnhookWindowsHookEx(mouseHook);
        keyboardHook = mouseHook = IntPtr.Zero;
    }

    static void OnDisplayChanged(object? sender, EventArgs e)
    {
        var screens = Screen.AllScreens;
        foreach (var form in forms)
        {
            var screen = screens.FirstOrDefault(s => s.DeviceName == form.DeviceName);
            if (screen != null)
                form.Cover(screen.Bounds);
        }
    }

    // The test aid: close after ORRERY_EXIT_AFTER seconds.
    static void ExitAfter(Action quit)
    {
        var text = Environment.GetEnvironmentVariable("ORRERY_EXIT_AFTER");
        if (!double.TryParse(text, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var seconds) || seconds <= 0)
            return;
        var timer = new System.Windows.Forms.Timer { Interval = (int)Math.Clamp(seconds * 1000, 1, int.MaxValue) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            Log.Write("screensaver: ORRERY_EXIT_AFTER");
            quit();
        };
        timer.Start();
    }

    // ---- /p ----

    public static int Preview(IntPtr parent)
    {
        if (parent == IntPtr.Zero || !NativeMethods.IsWindow(parent))
            return 0;
        // Draw at the dialog's own DPI awareness: a child of another
        // awareness gets sized and scaled wrongly across processes.
        try
        {
            var awareness = NativeMethods.GetWindowDpiAwarenessContext(parent);
            if (awareness != IntPtr.Zero)
                NativeMethods.SetThreadDpiAwarenessContext(awareness);
        }
        catch (EntryPointNotFoundException)
        {
            // older Windows: keep the process's
        }
        var form = new PreviewForm(parent);
        ExitAfter(form.End);
        Application.Run(form);
        return 0;
    }

    // ---- making it the screensaver ----

    // Orrery.scr next to this exe.
    public static string ScrPath(string exePath) => Path.ChangeExtension(exePath, ".scr");

    // The 8.3 form of an existing path, or the path itself if there is none.
    public static string ShortPath(string path)
    {
        var size = NativeMethods.GetShortPathName(path, null, 0);
        if (size == 0)
            return path;
        var buffer = new char[size];
        var length = NativeMethods.GetShortPathName(path, buffer, (uint)buffer.Length);
        return length == 0 || length >= buffer.Length ? path : new string(buffer, 0, (int)length);
    }

    // Sets Orrery.scr as the screensaver in HKCU. False if there is no .scr.
    public static bool MakeCurrent()
    {
        var exe = Environment.ProcessPath;
        if (exe == null)
            return false;
        var scr = ScrPath(exe);
        if (!File.Exists(scr))
            return false;
        try
        {
            using (var key = Registry.CurrentUser.CreateSubKey(@"Control Panel\Desktop"))
            {
                key.SetValue("SCRNSAVE.EXE", ShortPath(scr), RegistryValueKind.String);
                key.SetValue("ScreenSaveActive", "1", RegistryValueKind.String);
                if (key.GetValue("ScreenSaveTimeOut") == null)
                    key.SetValue("ScreenSaveTimeOut", "600", RegistryValueKind.String);
            }
            NativeMethods.SystemParametersInfo(NativeMethods.SPI_SETSCREENSAVEACTIVE, 1, IntPtr.Zero, NativeMethods.SPIF_SENDWININICHANGE);
            Log.Write($"screensaver: set to {scr}");
            return true;
        }
        catch (Exception e)
        {
            Log.Write($"screensaver: could not set: {e.Message}");
            return false;
        }
    }

    // ---- the windows ----

    // One screen's black window and its page.
    sealed class SaverForm : Form, IPageOwner
    {
        Rectangle area;
        Page? page;

        public string DeviceName { get; }
        public bool IsPrimary { get; }

        public SaverForm(Screen screen)
        {
            DeviceName = screen.DeviceName;
            IsPrimary = screen.Primary;
            area = screen.Bounds;
            Text = "Orrery screensaver";
            Icon = Program.AppIcon;
            BackColor = Color.Black;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            AutoScaleMode = AutoScaleMode.None;
            Bounds = area;
        }

        // Physical pixels (the app is per-monitor aware): put it right
        // past any DPI scaling the move onto its screen brought.
        public void Cover(Rectangle bounds)
        {
            area = bounds;
            if (IsHandleCreated)
                NativeMethods.SetWindowPos(Handle, NativeMethods.HWND_TOPMOST, bounds.X, bounds.Y, bounds.Width, bounds.Height, NativeMethods.SWP_NOACTIVATE);
            else
                Bounds = bounds;
        }

        protected override void OnDpiChanged(DpiChangedEventArgs e)
        {
            base.OnDpiChanged(e);
            Cover(area);
        }

        protected override async void OnShown(EventArgs e)
        {
            base.OnShown(e);
            Cover(area);
            try
            {
                page = await Page.Create(this, "dream", this);
            }
            catch (Exception ex)
            {
                Log.Write($"screensaver: no page: {ex.Message}");    // stays black
            }
        }

        public bool Call(string action, string arg)
        {
            switch (action)
            {
            case "exit":
                Dismiss("page exit");
                return true;
            case "immersive":
            case "keepScreenOn":
                return true;    // full screen already; the power plan decides the rest
            }
            return false;
        }

        public void PageReady()
        {
            if (page == null)
                return;
            page.MarkReady();
            _ = page.View.CoreWebView2?.ExecuteScriptAsync(NoCursorScript);
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            page?.Dispose();
            page = null;
            base.OnFormClosed(e);
        }
    }

    // The cursor over the page is the page's, not this process's.
    const string NoCursorScript =
        "(function(){var s=document.createElement('style');s.textContent='*{cursor:none!important}';document.documentElement.appendChild(s);})()";

    // The preview: a child of the dialog's little monitor. A drawn orrery
    // shows at once and stays until the live page is ready (or for good,
    // if WebView2 cannot start).
    sealed class PreviewForm : Form, IPageOwner
    {
        readonly IntPtr parent;
        readonly StillOrrery still;
        readonly System.Windows.Forms.Timer watch;
        Page? page;
        bool ended;
        const double PreviewZoom = 0.4;

        public PreviewForm(IntPtr parent)
        {
            this.parent = parent;
            Text = "Orrery preview";
            BackColor = Color.Black;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            // Not ShowInTaskbar = false: WinForms then gives the form a hidden
            // owner through GWL_HWNDPARENT, which for a child is its parent.
            AutoScaleMode = AutoScaleMode.None;
            var size = ParentSize();
            Location = Point.Empty;
            Size = size;
            still = new StillOrrery { Dock = DockStyle.Fill };
            Controls.Add(still);
            watch = new System.Windows.Forms.Timer { Interval = 500 };
            watch.Tick += (_, _) =>
            {
                if (!NativeMethods.IsWindow(parent))
                {
                    End();
                    return;
                }
                KeepInParent();
                var now = ParentSize();
                if (now != ClientSize && IsHandleCreated)
                    NativeMethods.SetWindowPos(Handle, IntPtr.Zero, 0, 0, now.Width, now.Height, NativeMethods.SWP_NOZORDER | NativeMethods.SWP_NOACTIVATE);
            };
        }

        Size ParentSize() =>
            NativeMethods.GetClientRect(parent, out var r) ? new Size(Math.Max(1, r.Right - r.Left), Math.Max(1, r.Bottom - r.Top)) : new Size(1, 1);

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                // Disabled: the dialog keeps the focus and the clicks.
                cp.Style = NativeMethods.WS_CHILD | NativeMethods.WS_VISIBLE | NativeMethods.WS_CLIPCHILDREN | NativeMethods.WS_DISABLED;
                cp.ExStyle = 0;
                cp.Parent = parent;
                var size = ParentSize();
                cp.X = 0;
                cp.Y = 0;
                cp.Width = size.Width;
                cp.Height = size.Height;
                return cp;
            }
        }

        protected override bool ShowWithoutActivation => true;

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            KeepInParent();
        }

        // In the dialog's monitor, whatever WinForms did to the window.
        void KeepInParent()
        {
            if (IsHandleCreated && NativeMethods.GetParent(Handle) != parent && NativeMethods.IsWindow(parent))
            {
                Log.Write($"preview: back into 0x{parent:X}");
                NativeMethods.SetParent(Handle, parent);
            }
        }

        protected override async void OnShown(EventArgs e)
        {
            base.OnShown(e);
            KeepInParent();
            watch.Start();
            try
            {
                var made = await Page.Create(this, "dream", this);
                if (ended)
                {
                    made.Dispose();     // the dialog went while it started
                    return;
                }
                page = made;
                // Lay the page out as on a screen 2.5 times larger, so its
                // cards and labels sit as they do in the real thing.
                page.View.ZoomFactor = PreviewZoom;
                still.BringToFront();
            }
            catch (Exception ex)
            {
                Log.Write($"preview: no page, staying drawn: {ex.Message}");
            }
        }

        public bool Call(string action, string arg) => action is "exit" or "immersive" or "keepScreenOn";

        public void PageReady()
        {
            if (page == null)
                return;
            page.MarkReady();
            // Let the page draw a few frames before it replaces the drawing.
            var reveal = new System.Windows.Forms.Timer { Interval = 600 };
            reveal.Tick += (_, _) =>
            {
                reveal.Dispose();
                still.Visible = false;
            };
            reveal.Start();
        }

        // The dialog destroys its windows, ours with them, without a close.
        protected override void OnHandleDestroyed(EventArgs e)
        {
            base.OnHandleDestroyed(e);
            if (!RecreatingHandle)
                End();
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            End();
            base.OnFormClosed(e);
        }

        // Leaves the message loop, however the preview ends.
        public void End()
        {
            if (ended)
                return;
            ended = true;
            watch.Stop();
            watch.Dispose();
            page?.Dispose();
            page = null;
            Application.ExitThread();
        }
    }

    // A still orrery in GDI+: the Sun, the orbits and the planets where
    // they are today (mean longitudes, near enough for a thumbnail).
    sealed class StillOrrery : Control
    {
        // name, colour, size, mean longitude at J2000 (deg), period (days)
        static readonly (Color color, float size, double l0, double period)[] planets =
        [
            (Color.FromArgb(170, 160, 150), 1.0f, 252.25, 87.969),
            (Color.FromArgb(230, 200, 140), 1.5f, 181.98, 224.701),
            (Color.FromArgb(90, 150, 230), 1.6f, 100.46, 365.256),
            (Color.FromArgb(220, 110, 70), 1.2f, 355.43, 686.98),
            (Color.FromArgb(220, 180, 140), 2.6f, 34.40, 4332.59),
            (Color.FromArgb(230, 210, 150), 2.3f, 49.94, 10759.2),
            (Color.FromArgb(150, 220, 230), 1.8f, 313.23, 30688.5),
            (Color.FromArgb(90, 120, 230), 1.8f, 304.88, 60182),
        ];

        public StillOrrery()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
            BackColor = Color.Black;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.Clear(Color.Black);
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            var w = ClientSize.Width;
            var h = ClientSize.Height;
            if (w < 4 || h < 4)
                return;
            var cx = w / 2f;
            var cy = h / 2f;
            var unit = Math.Min(w, h) / 120f;     // planet sizes
            var outer = Math.Min(w * 0.46f, h * 0.46f / 0.55f);

            // A few stars, the same every time.
            var rng = new Random(7);
            using (var star = new SolidBrush(Color.FromArgb(110, 255, 255, 255)))
                for (var i = 0; i < 60; i++)
                    g.FillRectangle(star, (float)rng.NextDouble() * w, (float)rng.NextDouble() * h, 1, 1);

            var days = (DateTime.UtcNow - new DateTime(2000, 1, 1, 12, 0, 0, DateTimeKind.Utc)).TotalDays;
            using var orbit = new Pen(Color.FromArgb(55, 140, 160, 200), 1);
            for (var i = 0; i < planets.Length; i++)
            {
                var p = planets[i];
                var r = outer * (i + 1.4f) / (planets.Length + 0.4f);
                var ry = r * 0.55f;     // seen from a little above the plane
                g.DrawEllipse(orbit, cx - r, cy - ry, 2 * r, 2 * ry);
                var a = (p.l0 + 360 * days / p.period) * Math.PI / 180;
                var x = cx + r * (float)Math.Cos(a);
                var y = cy - ry * (float)Math.Sin(a);
                var s = Math.Max(1.5f, p.size * unit);
                using var brush = new SolidBrush(p.color);
                g.FillEllipse(brush, x - s, y - s, 2 * s, 2 * s);
                if (i == 5)
                    using (var ring = new Pen(Color.FromArgb(160, p.color), Math.Max(1, unit * 0.4f)))
                        g.DrawEllipse(ring, x - s * 2, y - s * 0.7f, s * 4, s * 1.4f);
            }

            var sun = Math.Max(3, unit * 4.5f);
            using (var glow = new System.Drawing.Drawing2D.GraphicsPath())
            {
                glow.AddEllipse(cx - sun * 2.5f, cy - sun * 2.5f, sun * 5, sun * 5);
                using var halo = new System.Drawing.Drawing2D.PathGradientBrush(glow)
                {
                    CenterColor = Color.FromArgb(120, 255, 200, 80),
                    SurroundColors = [Color.FromArgb(0, 255, 160, 40)],
                };
                g.FillPath(halo, glow);
            }
            using (var core = new SolidBrush(Color.FromArgb(255, 236, 160)))
                g.FillEllipse(core, cx - sun, cy - sun, 2 * sun, 2 * sun);

            if (h >= 60)
            {
                using var font = new Font("Segoe UI", Math.Max(6, h / 16f), FontStyle.Regular, GraphicsUnit.Pixel);
                using var text = new SolidBrush(Color.FromArgb(170, 220, 225, 235));
                var size = g.MeasureString("Orrery", font);
                g.DrawString("Orrery", font, text, w - size.Width - h / 30f, h - size.Height - h / 40f);
            }
        }
    }

    static class NativeMethods
    {
        public delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);

        public const int WH_KEYBOARD_LL = 13, WH_MOUSE_LL = 14;
        public const int WM_KEYDOWN = 0x100, WM_SYSKEYDOWN = 0x104;
        public const int WM_MOUSEMOVE = 0x200, WM_LBUTTONDOWN = 0x201, WM_RBUTTONDOWN = 0x204, WM_MBUTTONDOWN = 0x207,
            WM_MOUSEWHEEL = 0x20A, WM_XBUTTONDOWN = 0x20B, WM_MOUSEHWHEEL = 0x20E;
        public const int WS_CHILD = 0x40000000, WS_VISIBLE = 0x10000000, WS_DISABLED = 0x08000000, WS_CLIPCHILDREN = 0x02000000;
        public const uint SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10;
        public static readonly IntPtr HWND_TOPMOST = new(-1);
        public const uint SPI_SETSCREENSAVEACTIVE = 0x0011, SPIF_SENDWININICHANGE = 0x2;

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int X, Y; }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left, Top, Right, Bottom; }

        [StructLayout(LayoutKind.Sequential)]
        public struct MSLLHOOKSTRUCT
        {
            public POINT pt;
            public uint mouseData, flags, time;
            public IntPtr extraInfo;
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SetWindowsHookEx(int idHook, HookProc fn, IntPtr module, uint threadId);

        [DllImport("user32.dll")]
        public static extern bool UnhookWindowsHookEx(IntPtr hook);

        [DllImport("user32.dll")]
        public static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr GetModuleHandle(string? name);

        [DllImport("user32.dll")]
        static extern bool GetCursorPos(out POINT p);

        public static bool GetCursorPos(out Point p)
        {
            var ok = GetCursorPos(out POINT q);
            p = new Point(q.X, q.Y);
            return ok;
        }

        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hwnd);

        [DllImport("user32.dll")]
        public static extern IntPtr GetParent(IntPtr hwnd);

        [DllImport("user32.dll")]
        public static extern IntPtr SetParent(IntPtr child, IntPtr parent);

        [DllImport("user32.dll")]
        public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);

        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);

        [DllImport("user32.dll")]
        public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);

        [DllImport("user32.dll")]
        public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern uint GetShortPathName(string longPath, [Out] char[]? shortPath, uint size);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SystemParametersInfo(uint action, uint param, IntPtr pvParam, uint winIni);
    }
}
