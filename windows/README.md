# Orrery for Windows

Orrery on Windows is one small program, `Orrery.exe`, that shows the same page as [Orrery for Android](https://github.com/fqazzazee/orrery-android) in a WebView2. The page draws with the extension's own `lib/` modules, so the astronomy and the missions are the same code everywhere.

It runs three ways:

| Started as | What you get |
|---|---|
| `Orrery.exe` | The app: the whole orrery in a window, with its controls and settings. F11 for full screen. |
| `Orrery.exe --wallpaper` | The live wallpaper, behind the desktop icons, with a tray icon. |
| `Orrery.scr` | The screensaver. It is the same exe, renamed. Windows starts it with `/s`, `/p <hwnd>` for the preview, and `/c` for its settings. |

## Layout

```
windows/
  Orrery/            the C# host: .NET 10, WinForms and WebView2
    Program.cs         picks the mode from the arguments and the file name
    Page.cs            one WebView2 page, served from app/ as https://orrery.app/
    Bridge.cs          window.OrreryHost: what the page can ask of the host
    AppWindow.cs       the app's window (and the screensaver's settings)
    Integration.cs     the screensaver and wallpaper settings in Windows
    orrery.ico         the icon, made from docs/icon.svg
  web/               the page, copied from Orrery for Android
  installer/         orrery.iss, the Inno Setup 6 installer
  lively/            LivelyInfo.json and a start page for Lively Wallpaper
  build.ps1          builds everything into dist/windows/
```

The project copies `web/` to `app/web` and ten modules from `lib/` to `app/lib` beside the exe, so the page's `../../lib/*.js` imports work as they do in the Android app's assets. Settings, the log (`orrery.log`) and the WebView2 profile live in `%LOCALAPPDATA%\Orrery`.

## Build

You need the .NET 10 SDK. The WebView2 Runtime comes with Windows 11, and with Windows 10 once Edge has updated.

```powershell
dotnet build windows/Orrery -c Release      # a quick build, in windows/Orrery/bin/
windows/build.ps1                           # every package, into dist/windows/
windows/build.ps1 -Arch x64 -NoInstaller    # just the x64 folder and zip
```

`build.ps1` reads the version from `metadata.json` (`version-name`) and makes:

- `Orrery-VERSION-win-x64/` and `-win-arm64/`: the app folder. It is a self-contained publish, not a single file, so `Orrery.exe` and `Orrery.scr` are both small apphosts beside the .NET runtime and `app/`. Nobody needs .NET installed. It is about 112 MB on disk for x64.
- `Orrery-VERSION-win-x64.zip` (about 47 MB) and the arm64 one: that folder, to unzip anywhere.
- `Orrery-VERSION-win-x64-setup.exe` (about 35 MB) and the arm64 one, if Inno Setup 6 is found. It looks in `$env:ISCC`, on the PATH, and in Inno Setup's usual folders.
- `Orrery-VERSION-lively.zip`: `web/`, `lib/` and `lively/`, for [Lively Wallpaper](https://www.rocksdanister.com/lively/). Drag it into Lively. Lively serves the folder its start file is in and passes no query string, so `lively/index.html` sits at the top and sends the page on to `web/index.html?surface=wallpaper`.
- `SHA256SUMS-windows`.

`-Step publish`, `-Step package` and `-Step sums` run one part at a time. The release workflow uses them to sign the exes before they are zipped, and the installers before the checksums.

WinForms cannot be trimmed, which is why the folder is that big. A framework-dependent build would be a few MB, but people would need the .NET 10 Desktop Runtime first.

## The installer

`installer/orrery.iss` installs for the current user only, into `%LOCALAPPDATA%\Programs\Orrery`, with no admin prompt. It adds Start menu shortcuts for the app and the live wallpaper. Two tasks are off by default:

- **Use Orrery as my screensaver** sets `SCRNSAVE.EXE` in `HKCU\Control Panel\Desktop` to the short path of `Orrery.scr`, and turns the screensaver on.
- **Start the live wallpaper with Windows** adds `Orrery` to `HKCU\...\CurrentVersion\Run`.

If the WebView2 Runtime is missing, a third task downloads and runs Microsoft's Evergreen bootstrapper. The uninstaller stops any Orrery running from the install folder, removes the Run value, and clears the screensaver only if it is ours.

## Run each mode

From `windows/Orrery/bin/Release/net10.0-windows/`, or a folder in `dist/windows/`:

```powershell
.\Orrery.exe                 # the app
.\Orrery.exe --wallpaper     # the live wallpaper; quit it from its tray icon
copy Orrery.exe Orrery.scr   # if there is no Orrery.scr yet
.\Orrery.scr /s              # the screensaver
.\Orrery.scr /c              # its settings
```

To try `Orrery.scr` from the Screen Saver Settings box, right-click it and choose **Install**, or use the settings page's **Use Orrery** button.

## Working on the page

The page also runs in a plain browser. Lay out `web/` and the ten `lib/` files side by side, as the project does, and serve them:

```sh
mkdir -p /tmp/orrery/lib && cp -r windows/web /tmp/orrery/web
cp lib/{astro,bodies,facts,lunar,missions,moon-missions,render,satellites,tour,waypoints}.js /tmp/orrery/lib/
cd /tmp/orrery && python -m http.server 8000
```

Then open `http://localhost:8000/web/index.html`. Add `?settings=wallpaper` to open a settings page, or `?surface=wallpaper` to see the wallpaper. `?platform=windows` fakes the Windows host with a tiny stub (in `host.js`, marked dev only), so the settings page shows its Windows rows. The stub keeps its settings and status in local storage.

## Where web/ came from

`web/` is a copy of the Android app's page (its web layer) from [orrery-android](https://github.com/fqazzazee/orrery-android) at commit `2754e5f` ("Release 1.2.3"). Changes since:

- `js/host.js` tells Windows from Android: WebView2 sets `window.OrreryPlatform = 'windows'`, and the module exports `platform`, `onAndroid` and `onWindows`. Windows plays music and reads the battery as a browser does. It also has the `?platform=windows` stub for development.
- `js/settings.js` has the Windows "Set up" rows: start and stop the live wallpaper, and use Orrery as the screensaver or open Windows' Screen Saver Settings. Windows has no live lock screen, so its page is hidden there.

When the Android page changes, copy it over again and keep these changes.
