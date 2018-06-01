import PluginUpdater from "../modules/pluginupdater";
import ReactTools from "../modules/reacttools";
import Modals from "../ui/modals";
import PluginUtilities from "../modules/pluginutilities";
import * as Settings from "../ui/settings";

export default function(config) {
    return class Plugin {
        constructor() {
            this._config = config;
            this._enabled = false;
            if (typeof(config.defaultConfig) != "undefined") {
                this.defaultSettings = {};
                for (let s = 0; s < config.length; s++) {
                    const current = config[s];
                    if (current.type != "category") this.defaultSettings[current.id] = current.value;
                    else {
                        this.defaultSettings[current.id] = {};
                        for (let s = 0; s < config.length; s++) {
                            const current = config[s];
                            this.defaultSettings[current.id][current.id] = current.value;
                        }
                    }
                }
                this._hasConfig = true;
                this.settings = {};
            }
        }
        getName() { return this._config.info.name.replace(" ", ""); }
        getDescription() { return this._config.info.description; }
        getVersion() { return this._config.info.version; }
        getAuthor() { return this._config.info.authors.map(a => a.name).join(", "); }
        load() {}
        start() {
            if (this.defaultSettings) this.settings = this.loadSettings();
            const currentVersionInfo = PluginUtilities.loadData(this.getName(), "currentVersionInfo", {version: this.getVersion(), hasShownChangelog: false});
            if (currentVersionInfo.version != this.getVersion() || !currentVersionInfo.hasShownChangelog) {
                this.showChangelog();
                PluginUtilities.saveData(this.getName(), "currentVersionInfo", {version: this.getVersion(), hasShownChangelog: true});
            }
            PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), this._config.info.github_raw);
            this._enabled = true;
            if (typeof(this.onStart) == "function") this.onStart();
        }
        stop() {
            this._enabled = false;
            if (typeof(this.onStop) == "function") this.onStop();
        }

        get isEnabled() {return this._enabled;}

        showSettingsModal() {
            if (typeof(this.getSettingsPanel) != "function") return;
            Modals.showModal(this.getName() + " Settings", ReactTools.createWrappedElement(this.getSettingsPanel()), {
                cancelText: "",
                confirmText: "Done",
                size: Modals.ModalSizes.MEDIUM
            });
        }

        showChangelog(footer) {
            if (typeof(this._config.changelog) == "undefined") return;
            Modals.showChangelogModal(this.getName() + " Changelog", this.getVersion(), this._config.changelog, footer);
        }

        saveSettings(settings) {
            PluginUtilities.saveSettings(this.getName(), this.settings ? this.settings : settings);
        }

        loadSettings(defaultSettings) {
            return PluginUtilities.loadSettings(this.getName(), this.defaultSettings ? this.defaultSettings : defaultSettings);
        }

        buildSetting(data) {
            const {name, note, type, value, onChange} = data;
            if (type == "color")
                return new Settings.ColorPicker(name, note, value, onChange, {disabled: data.disabled, presetColors: data.presetColors});
            else if (type == "dropdown")
                return new Settings.Dropdown(name, note, value, data.options, onChange);
            else if (type == "file")
                return new Settings.FilePicker(name, note, onChange);
            else if (type == "keybind")
                return new Settings.Keybind(name, note, value, onChange);
            else if (type == "radio")
                return new Settings.RadioGroup(name, note, value, data.options, onChange, {disabled: data.disabled});
            else if (type == "slider") {
                const options = {};
                if (typeof(data.markers) != "undefined") options.markers = data.markers;
                if (typeof(data.stickToMarkers) != "undefined") options.stickToMarkers = data.stickToMarkers;
                return new Settings.Slider(name, note, data.min, data.max, value, onChange, options);
            }
            else if (type == "switch")
                return new Settings.Switch(name, note, value, onChange, {disabled: data.disabled});
            else if (type == "textbox")
                return new Settings.Textbox(name, note, value, onChange, {placeholder: data.placeholder || ""});
        }

        buildSettingsPanel() {
            const config = this._config.defaultConfig;
            const buildGroup = (group) => {
                const {name, id, collapsible, shown, settings} = group;
                this.settings[id] = {};

                const list = [];
                for (let s = 0; s < settings.length; s++) {
                    const current = settings[s];
                    this.settings[id][current.id] = current.value;
                    current.onChange = (value) => {
                        this.settings[id][current.id] = value;
                    };
                    list.push(this.buildSetting(current));
                }
                
                return new Settings.SettingGroup(name, {shown, collapsible}).append(...list);
            };
            const list = [];
            for (let s = 0; s < config.length; s++) {
                const current = config[s];
                if (current.type != "category") {
                    this.settings[current.id] = current.value;
                    current.onChange = (value) => {
                        this.settings[current.id] = value;
                    };
                    list.push(this.buildSetting(current));
                }
                else list.push(buildGroup(current));
            }

            return new Settings.SettingPanel(this.saveSettings.bind(this), ...list);
        }
    };
}