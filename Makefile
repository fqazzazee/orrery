UUID := orrery@fqazzazee.github.io
EXTENSIONS_DIR := $(HOME)/.local/share/gnome-shell/extensions
DEST := $(EXTENSIONS_DIR)/$(UUID)

.PHONY: pack install link test clean

# Zip for sharing or uploading to extensions.gnome.org
pack:
	gnome-extensions pack --force --extra-source=lib --schema=schemas/org.gnome.shell.extensions.orrery.gschema.xml .

# Copies the files and compiles the settings schema
install:
	rm -rf $(DEST)
	mkdir -p $(DEST)/schemas
	cp -r metadata.json extension.js prefs.js stylesheet.css lib $(DEST)/
	cp schemas/*.gschema.xml $(DEST)/schemas/
	glib-compile-schemas $(DEST)/schemas
	@echo "Log out and back in, then: gnome-extensions enable $(UUID)"

# Development: run the extension straight from this checkout
link:
	glib-compile-schemas schemas
	mkdir -p $(EXTENSIONS_DIR)
	ln -sfn $(CURDIR) $(DEST)
	@echo "Log out and back in, then: gnome-extensions enable $(UUID)"

test:
	gjs -m tests/unit.js

clean:
	rm -f $(UUID).shell-extension.zip schemas/gschemas.compiled
