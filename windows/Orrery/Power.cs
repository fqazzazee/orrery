// SPDX-License-Identifier: GPL-2.0-or-later
// The charger and Windows' energy saver, for the page's battery saver
// (main.js setPower): {onBattery, charging, saver}.

using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace Orrery;

public static class Power
{
    [StructLayout(LayoutKind.Sequential)]
    struct SYSTEM_POWER_STATUS
    {
        public byte ACLineStatus;        // 0 off, 1 on, 255 unknown
        public byte BatteryFlag;         // 128 no battery, 8 charging
        public byte BatteryLifePercent;
        public byte SystemStatusFlag;    // 1 energy saver on
        public int BatteryLifeTime;
        public int BatteryFullLifeTime;
    }

    [DllImport("kernel32.dll")]
    static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS status);

    static event Action? changed;
    static bool hooked;

    public static event Action? Changed
    {
        add
        {
            if (!hooked)
            {
                hooked = true;
                SystemEvents.PowerModeChanged += (_, e) =>
                {
                    if (e.Mode == PowerModes.StatusChange)
                        changed?.Invoke();
                };
            }
            changed += value;
        }
        remove => changed -= value;
    }

    public static (bool onBattery, bool charging, bool saver) Read()
    {
        if (!GetSystemPowerStatus(out var s))
            return (false, true, false);
        var noBattery = (s.BatteryFlag & 128) != 0 || s.BatteryFlag == 255;
        var onBattery = !noBattery && s.ACLineStatus == 0;
        return (onBattery, !onBattery, s.SystemStatusFlag == 1);
    }

    public static bool OnBattery => Read().onBattery;

    public static string Json()
    {
        var (onBattery, charging, saver) = Read();
        return $"{{\"onBattery\":{(onBattery ? "true" : "false")},\"charging\":{(charging ? "true" : "false")},\"saver\":{(saver ? "true" : "false")}}}";
    }
}
