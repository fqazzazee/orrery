# Fedora, RHEL and openSUSE. Built by packaging/build.sh.
Name:           orrery-wallpaper
Version:        @VERSION@
Release:        1%{?dist}
Summary:        Live solar system wallpaper for KDE, XFCE, Cinnamon, MATE, Sway, Hyprland and more
License:        GPL-2.0-or-later
URL:            https://github.com/fqazzazee/orrery
Source0:        orrery-%{version}.tar.gz
BuildArch:      noarch

BuildRequires:  systemd-rpm-macros
Requires:       gjs
Requires:       gtk4
Recommends:     gtk4-layer-shell

%description
Orrery for desktops other than GNOME Shell (which has its own extension):
the solar system as it is right now, with the planets turned the way they
really face, their moons, and the spacecraft of the space age on their
real paths. "orrery-wallpaper daemon" keeps the wallpaper up to date on
KDE Plasma, XFCE, Cinnamon, MATE, Budgie, LXQt, Sway and Hyprland;
"orrery-wallpaper live" is an animated background on Wayland compositors
with layer-shell.

%prep
%autosetup -n orrery-%{version}

%build
# Nothing to build: GJS.

%install
sh packaging/install-wallpaper.sh %{buildroot} %{_prefix}

%files
%license LICENSE
%doc README.md
%{_bindir}/orrery-wallpaper
%{_datadir}/orrery-wallpaper/
%{_userunitdir}/orrery-wallpaper.service
%{_userunitdir}/orrery-wallpaper-live.service

%changelog
* @DATE@ Fadi Q <fadi.qazzazee@gmail.com> - @VERSION@-1
- Release @VERSION@
