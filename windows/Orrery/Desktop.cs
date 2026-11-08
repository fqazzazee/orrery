// SPDX-License-Identifier: GPL-2.0-or-later
// Where the wallpaper's windows go: behind the desktop icons, in one of the
// two layouts Explorer has had. Found by looking at the windows, not at the
// Windows version.
//
// Legacy (Windows 10, Windows 11 before 24H2): 0x052C makes Progman split
// off a top-level WorkerW holding SHELLDLL_DefView (the icons), and another
// WorkerW behind it that paints the wallpaper. Ours go inside that one.
//
// Raised (Windows 11 24H2 and later): Progman has WS_EX_NOREDIRECTIONBITMAP,
// and SHELLDLL_DefView and the wallpaper's WorkerW are both its children.
// Ours go into Progman as layered children, between those two.

using static Orrery.Native;

namespace Orrery;

public enum DesktopLayout { Legacy, Raised }

public sealed record DesktopTarget(DesktopLayout Layout, IntPtr Progman, IntPtr Parent, IntPtr DefView, IntPtr WorkerW)
{
    public override string ToString() =>
        $"{Layout}: parent 0x{Parent.ToInt64():X} ({ClassOf(Parent)}), DefView 0x{DefView.ToInt64():X}, WorkerW 0x{WorkerW.ToInt64():X}";
}

public static class Desktop
{
    // The place for the wallpaper's windows, or null if Explorer has none yet.
    public static DesktopTarget? Find()
    {
        var progman = FindWindow("Progman", null);
        if (progman == IntPtr.Zero)
            return null;
        var found = Inspect(progman);
        if (found != null && found.WorkerW != IntPtr.Zero)
            return found;
        // Ask Progman for the wallpaper's WorkerW: the newer form, then the old.
        foreach (var (w, l) in new[] { (0xD, 1), (0, 0) })
        {
            SendMessageTimeout(progman, 0x052C, (IntPtr)w, (IntPtr)l, SMTO_NORMAL, 1000, out _);
            found = Inspect(progman);
            if (found != null && found.WorkerW != IntPtr.Zero)
                return found;
        }
        return found;
    }

    static DesktopTarget? Inspect(IntPtr progman)
    {
        var defView = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
        if (defView != IntPtr.Zero)
        {
            // The icons are Progman's own child: raised if Progman draws
            // through DirectComposition or already holds the WorkerW.
            // Otherwise it is the legacy layout before 0x052C.
            var worker = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null);
            var noRedirection = (GetWindowLong(progman, GWL_EXSTYLE) & WS_EX_NOREDIRECTIONBITMAP) != 0;
            return worker != IntPtr.Zero || noRedirection
                ? new DesktopTarget(DesktopLayout.Raised, progman, progman, defView, worker)
                : null;
        }
        // Legacy: the top-level WorkerW holding the icons; the wallpaper's
        // WorkerW is the next top-level WorkerW after it.
        foreach (var top in TopLevelWindows())
        {
            if (ClassOf(top) != "WorkerW")
                continue;
            var icons = FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (icons == IntPtr.Zero)
                continue;
            var worker = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
            // Some builds paint the wallpaper in Progman itself.
            return new DesktopTarget(DesktopLayout.Legacy, progman, worker != IntPtr.Zero ? worker : progman, icons, worker);
        }
        return null;
    }

    // Puts a wallpaper window over `screen` (screen pixels) in its parent.
    public static void Place(IntPtr hwnd, DesktopTarget target, Rectangle screen)
    {
        var r = new RECT { Left = screen.Left, Top = screen.Top, Right = screen.Right, Bottom = screen.Bottom };
        MapWindowPoints(IntPtr.Zero, target.Parent, ref r, 2);
        // Raised: just below the icons, so above the WorkerW. Legacy: alone in its WorkerW.
        var after = target.Layout == DesktopLayout.Raised ? target.DefView : IntPtr.Zero;
        SetWindowPos(hwnd, after, r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top, SWP_NOACTIVATE | SWP_SHOWWINDOW);
    }

    // The desktop's windows, for the log.
    public static string Dump()
    {
        var lines = new List<string>();
        var progman = FindWindow("Progman", null);
        void Tree(IntPtr parent, int depth)
        {
            for (var c = GetWindow(parent, GW_CHILD); c != IntPtr.Zero; c = GetWindow(c, GW_HWNDNEXT))
            {
                lines.Add(new string(' ', depth * 2) + Describe(c));
                if (depth < 2 && ClassOf(c) != "Chrome_WidgetWin_0")
                    Tree(c, depth + 1);
            }
        }
        if (progman != IntPtr.Zero)
        {
            lines.Add(Describe(progman));
            Tree(progman, 1);
        }
        foreach (var top in TopLevelWindows())
        {
            if (ClassOf(top) != "WorkerW")
                continue;
            lines.Add(Describe(top));
            Tree(top, 1);
        }
        return string.Join(Environment.NewLine, lines);
    }
}

// One monitor's window behind the icons: a child of Explorer's window, which
// holds that monitor's page.
public sealed class WallpaperHost : Control
{
    readonly DesktopTarget target;
    readonly Rectangle screen;

    public WallpaperHost(DesktopTarget target, Rectangle screen)
    {
        this.target = target;
        this.screen = screen;
        BackColor = Color.Black;
        SetStyle(ControlStyles.Selectable, false);
    }

    public Rectangle ScreenBounds => screen;

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.Parent = target.Parent;
            cp.Style = WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS;
            cp.ExStyle = WS_EX_NOACTIVATE | (target.Layout == DesktopLayout.Raised ? WS_EX_LAYERED : 0);
            cp.X = 0;
            cp.Y = 0;
            cp.Width = screen.Width;
            cp.Height = screen.Height;
            return cp;
        }
    }

    public void Attach()
    {
        CreateControl();
        // A layered window shows nothing until it has its attributes.
        if (target.Layout == DesktopLayout.Raised)
            SetLayeredWindowAttributes(Handle, 0, 255, LWA_ALPHA);
        Desktop.Place(Handle, target, screen);
    }

    // The page's CSS pixels per screen pixel: what WebView2 renders at.
    public double CssScale => IsHandleCreated ? Math.Max(1, GetDpiForWindow(Handle)) / 96.0 : 1;
}
