// SPDX-License-Identifier: GPL-2.0-or-later
// The settings every surface shares: one JSON object in
// %APPDATA%\Orrery\settings.json, as the Android app keeps one in its
// SharedPreferences. The app, the wallpaper and the screensaver may each
// run in their own process, so each watches the file and tells its pages
// about the keys another one changed.

using System.Text.Json;
using System.Text.Json.Nodes;

namespace Orrery;

public sealed class SettingsStore : IDisposable
{
    public static readonly string Folder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Orrery");
    static readonly string FilePath = Path.Combine(Folder, "settings.json");

    static SettingsStore? shared;
    public static SettingsStore Shared => shared ??= new SettingsStore();

    JsonObject values;
    string lastWritten = "";
    readonly FileSystemWatcher? watcher;
    readonly SynchronizationContext? ui;

    // key, value (JSON text, "null" when removed), for another process's change.
    public event Action<string, string>? Changed;

    SettingsStore()
    {
        Directory.CreateDirectory(Folder);
        values = Read();
        ui = SynchronizationContext.Current;
        try
        {
            watcher = new FileSystemWatcher(Folder, "settings.json")
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size,
                EnableRaisingEvents = true,
            };
            watcher.Changed += (_, _) => Post(Reload);
            watcher.Created += (_, _) => Post(Reload);
            watcher.Renamed += (_, _) => Post(Reload);
        }
        catch (Exception e)
        {
            Log.Write($"settings: no watcher: {e.Message}");
        }
    }

    void Post(Action a)
    {
        if (ui != null)
            ui.Post(_ => a(), null);
        else
            a();
    }

    static JsonObject Read()
    {
        for (int attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                if (!File.Exists(FilePath))
                    return new JsonObject();
                return JsonNode.Parse(File.ReadAllText(FilePath)) as JsonObject ?? new JsonObject();
            }
            catch (IOException)
            {
                Thread.Sleep(30);   // another process is writing it
            }
            catch (JsonException e)
            {
                Log.Write($"settings: unreadable, starting afresh: {e.Message}");
                return new JsonObject();
            }
        }
        return new JsonObject();
    }

    public string AllJson() => values.ToJsonString();

    public JsonNode? Get(string key) => values[key];

    // value: JSON text from the page; "null" removes the key.
    public void Save(string key, string json)
    {
        JsonNode? node;
        try
        {
            node = JsonNode.Parse(json);
        }
        catch (JsonException)
        {
            return;
        }
        if (node == null)
            values.Remove(key);
        else
            values[key] = node;
        Write();
    }

    void Write()
    {
        var text = values.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
        lastWritten = text;
        var temp = FilePath + ".tmp";
        try
        {
            File.WriteAllText(temp, text);
            File.Move(temp, FilePath, overwrite: true);
        }
        catch (IOException e)
        {
            Log.Write($"settings: not saved: {e.Message}");
        }
    }

    void Reload()
    {
        string text;
        try
        {
            text = File.Exists(FilePath) ? File.ReadAllText(FilePath) : "{}";
        }
        catch (IOException)
        {
            return;     // mid-write: the next event brings it
        }
        if (text == lastWritten)
            return;
        JsonObject fresh;
        try
        {
            fresh = JsonNode.Parse(text) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            return;
        }
        var old = values;
        values = fresh;
        lastWritten = text;
        foreach (var (key, value) in fresh)
        {
            var was = old[key]?.ToJsonString();
            var now = value?.ToJsonString() ?? "null";
            if (was != now)
                Changed?.Invoke(key, now);
        }
        foreach (var (key, _) in old)
            if (!fresh.ContainsKey(key))
                Changed?.Invoke(key, "null");
    }

    public void Dispose() => watcher?.Dispose();
}
