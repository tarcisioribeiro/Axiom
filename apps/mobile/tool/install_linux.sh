#!/usr/bin/env bash
# Builds the Linux desktop release and installs it for the current user,
# with a menu entry and taskbar icon. Re-run after each change to update.
#
# System deps (once): clang cmake ninja-build pkg-config libgtk-3-dev
# liblzma-dev libstdc++-12-dev libcurl4-openssl-dev zenity
set -euo pipefail

APP_ID="com.axiom.axiom_mobile" # must match APPLICATION_ID in linux/CMakeLists.txt
BIN="axiom_mobile"              # must match BINARY_NAME in linux/CMakeLists.txt
INSTALL_DIR="$HOME/.local/opt/axiom"
APPS_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"

cd "$(dirname "$0")/.."

flutter pub get
# Memory cap for the build (the sentry-native C++ compile spikes RAM): the
# kernel kills only the build if it goes over, instead of freezing the machine.
# Override with AXIOM_BUILD_MEM=6G, or AXIOM_BUILD_MEM=0 to disable.
BUILD_MEM="${AXIOM_BUILD_MEM:-4G}"
if [[ "$BUILD_MEM" != "0" ]] && command -v systemd-run >/dev/null; then
  systemd-run --user --scope --quiet -p MemoryMax="$BUILD_MEM" -p MemorySwapMax=0 \
    flutter build linux --release
else
  flutter build linux --release
fi

rm -rf "$INSTALL_DIR"
mkdir -p "$(dirname "$INSTALL_DIR")" "$APPS_DIR" "$ICON_DIR"
cp -r build/linux/x64/release/bundle "$INSTALL_DIR"
cp assets/icon/icon.png "$ICON_DIR/$APP_ID.png"

# Wayland matches the window's app_id to the .desktop filename;
# X11 uses StartupWMClass (check with `xprop WM_CLASS` if the icon is generic).
cat > "$APPS_DIR/$APP_ID.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Axiom
Comment=Axiom (Flutter desktop)
Exec=$INSTALL_DIR/$BIN
Icon=$APP_ID
Terminal=false
Categories=Office;Finance;
StartupWMClass=$BIN
StartupNotify=true
EOF

update-desktop-database "$APPS_DIR" 2>/dev/null || true
gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo "Installed to $INSTALL_DIR — look for \"Axiom\" in the app menu."
