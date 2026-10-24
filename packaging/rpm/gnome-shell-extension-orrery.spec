# Fedora, RHEL and openSUSE. Built by packaging/build.sh.
%global uuid orrery@fqazzazee.github.io

Name:           gnome-shell-extension-orrery
Version:        @VERSION@
Release:        1%{?dist}
Summary:        Live, OLED-black solar system wallpaper for GNOME Shell
License:        GPL-2.0-or-later
URL:            https://github.com/fqazzazee/orrery
Source0:        orrery-%{version}.tar.gz
BuildArch:      noarch

BuildRequires:  glib2
Requires:       gnome-shell >= 48
Recommends:     gstreamer1-plugins-good
Recommends:     gstreamer1-plugins-base

%description
Orrery turns the GNOME desktop into a live solar system: planets in their
real positions, spinning at their relative speeds, with the spacecraft of
the space age replaying their gravity-assist journeys. Click anything for
facts, scrub through history on a timeline, fly in to a planet's moons and
satellites, or pull back to the Oort cloud.

%prep
%autosetup -n orrery-%{version}

%build
# Nothing to build: GJS.

%install
sh packaging/install-extension.sh %{buildroot} %{_prefix}

%files
%license LICENSE
%doc README.md
%{_datadir}/gnome-shell/extensions/%{uuid}/

%changelog
* @DATE@ Fadi Q <fadi.qazzazee@gmail.com> - @VERSION@-1
- Release @VERSION@
