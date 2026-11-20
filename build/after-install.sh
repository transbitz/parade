#!/bin/bash
# Refresh desktop and icon caches so the launcher picks up the Parade icon.
if hash update-desktop-database 2>/dev/null; then
    update-desktop-database -q /usr/share/applications || true
fi
for dir in /usr/share/icons/hicolor /usr/local/share/icons/hicolor; do
    if [ -d "$dir" ] && hash gtk-update-icon-cache 2>/dev/null; then
        gtk-update-icon-cache -f -t "$dir" 2>/dev/null || true
    fi
done
exit 0
