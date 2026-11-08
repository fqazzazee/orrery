; SPDX-License-Identifier: GPL-2.0-or-later
; Orrery's installer for Windows (Inno Setup 6). It installs for the current
; user only, needs no admin rights, and can make Orrery the screensaver and
; start the live wallpaper with Windows. windows/build.ps1 builds it:
;   ISCC /DAppVersion=1.5.0 /DArch=x64 /DSourceDir=<publish folder> /O<dist> orrery.iss

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef Arch
  #define Arch "x64"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\dist\windows\Orrery-" + AppVersion + "-win-" + Arch
#endif

; The Evergreen WebView2 Runtime: its bootstrapper, and its client id in EdgeUpdate.
#define WebView2Url "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
#define WebView2Key "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

[Setup]
AppId={{6E0D3A55-2C1B-4C5E-9E0A-0F7B6C1D4A2E}
AppName=Orrery
AppVersion={#AppVersion}
AppVerName=Orrery {#AppVersion}
AppPublisher=fqazzazee
AppPublisherURL=https://github.com/fqazzazee/orrery
AppSupportURL=https://github.com/fqazzazee/orrery/issues
AppUpdatesURL=https://github.com/fqazzazee/orrery/releases/latest
AppCopyright=GPL-2.0-or-later
VersionInfoVersion={#AppVersion}
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\Orrery
DisableProgramGroupPage=yes
DisableDirPage=auto
#if Arch == "arm64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#else
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
#endif
WizardStyle=modern
SetupIconFile=..\Orrery\orrery.ico
UninstallDisplayIcon={app}\Orrery.exe
UninstallDisplayName=Orrery
OutputBaseFilename=Orrery-{#AppVersion}-win-{#Arch}-setup
Compression=lzma2/max
SolidCompression=yes
; Orrery's own processes are stopped in [Code], only those in {app}.
CloseApplications=no

[Tasks]
Name: screensaver; Description: "Use Orrery as my screensaver"; Flags: unchecked
Name: wallpaper; Description: "Start the live wallpaper with Windows"; Flags: unchecked
Name: webview2; Description: "Download and install the Microsoft Edge WebView2 Runtime, which Orrery needs"; Check: WebView2Missing

[InstallDelete]
; The page's files from an older version.
Type: filesandordirs; Name: "{app}\app"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Orrery"; Filename: "{app}\Orrery.exe"; Comment: "A live solar system"
Name: "{autoprograms}\Orrery live wallpaper"; Filename: "{app}\Orrery.exe"; Parameters: "--wallpaper"; Comment: "The solar system behind your desktop icons"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Orrery"; ValueData: """{app}\Orrery.exe"" --wallpaper"; Tasks: wallpaper; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "SCRNSAVE.EXE"; ValueData: "{code:ScreensaverPath}"; Tasks: screensaver
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "ScreenSaveActive"; ValueData: "1"; Tasks: screensaver
; Without a wait Windows never starts it: ten minutes, unless one is set.
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "ScreenSaveTimeOut"; ValueData: "600"; Tasks: screensaver; Flags: createvalueifdoesntexist

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing the Microsoft Edge WebView2 Runtime..."; Tasks: webview2; Check: WebView2Downloaded; Flags: waituntilterminated
Filename: "{app}\Orrery.exe"; Description: "Open Orrery"; Flags: nowait postinstall skipifsilent
Filename: "{app}\Orrery.exe"; Parameters: "--wallpaper"; Description: "Start the live wallpaper now"; Tasks: wallpaper; Flags: nowait postinstall skipifsilent

[Code]
const
  SPI_SETSCREENSAVEACTIVE = $0011;
  SPIF_UPDATEINIFILE_SENDCHANGE = 3;

var
  DownloadPage: TDownloadWizardPage;

function SystemParametersInfo(uiAction, uiParam: Cardinal; pvParam: Cardinal; fWinIni: Cardinal): Boolean;
  external 'SystemParametersInfoW@user32.dll stdcall';

function HasRuntime(RootKey: Integer): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(RootKey, '{#WebView2Key}', 'pv', Version) and
    (Version <> '') and (Version <> '0.0.0.0');
end;

// The runtime is installed for every user (HKLM, 32-bit view on 64-bit
// Windows) or for this one (HKCU).
function WebView2Missing: Boolean;
begin
  Result := not (HasRuntime(HKLM32) or HasRuntime(HKLM64) or HasRuntime(HKCU));
end;

function WebView2Downloaded: Boolean;
begin
  Result := FileExists(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'));
end;

// Windows wants a path without spaces here: the short one, where there is one.
function ScreensaverPath(Param: String): String;
begin
  Result := ExpandConstant('{app}\Orrery.scr');
  if GetShortName(Result) <> '' then
    Result := GetShortName(Result);
end;

// Stops the app, the wallpaper and the screensaver, if they run from {app}.
procedure StopOrrery;
var
  Code: Integer;
  Folder: String;
begin
  Folder := ExpandConstant('{app}');
  StringChangeEx(Folder, '''', '''''', True);
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -Command "Get-Process Orrery -ErrorAction SilentlyContinue | ' +
    'Where-Object { $_.Path -and $_.Path.StartsWith(''' + Folder + '\'', [StringComparison]::OrdinalIgnoreCase) } | ' +
    'Stop-Process -Force -ErrorAction SilentlyContinue"',
    '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage(SetupMessage(msgWizardPreparing), SetupMessage(msgPreparingDesc), nil);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = wpReady) and WizardIsTaskSelected('webview2') then
  begin
    DownloadPage.Clear;
    DownloadPage.Add('{#WebView2Url}', 'MicrosoftEdgeWebview2Setup.exe', '');
    DownloadPage.Show;
    try
      try
        DownloadPage.Download;
      except
        if not DownloadPage.AbortedByUser then
          SuppressibleMsgBox('The WebView2 Runtime could not be downloaded: ' + GetExceptionMessage + #13#10#13#10 +
            'Orrery will offer its download page when it starts.', mbInformation, MB_OK, IDOK);
      end;
    finally
      DownloadPage.Hide;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopOrrery;
  Result := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  // Tell Windows the screensaver changed, as its own settings box does.
  if (CurStep = ssPostInstall) and WizardIsTaskSelected('screensaver') then
    SystemParametersInfo(SPI_SETSCREENSAVEACTIVE, 1, 0, SPIF_UPDATEINIFILE_SENDCHANGE);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Current, Ours: String;
begin
  if CurUninstallStep <> usUninstall then
    Exit;
  StopOrrery;
  // Clear the screensaver only if it is ours.
  if RegQueryStringValue(HKCU, 'Control Panel\Desktop', 'SCRNSAVE.EXE', Current) then
  begin
    Ours := ExpandConstant('{app}\Orrery.scr');
    if (CompareText(Current, Ours) = 0) or (CompareText(Current, GetShortName(Ours)) = 0) then
    begin
      RegDeleteValue(HKCU, 'Control Panel\Desktop', 'SCRNSAVE.EXE');
      SystemParametersInfo(SPI_SETSCREENSAVEACTIVE, 0, 0, SPIF_UPDATEINIFILE_SENDCHANGE);
    end;
  end;
end;
