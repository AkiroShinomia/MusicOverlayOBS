obs = obslua

local process_name = "MusicOverlay.exe"

function script_description()
    return "Automatically starts MusicOverlay.exe when OBS starts. Place this script next to MusicOverlay.exe."
end

function is_process_running(name)
    local command = 'tasklist /FI "IMAGENAME eq ' .. name .. '" /NH'
    local handle = io.popen(command)

    if handle == nil then
        return false
    end

    local result = handle:read("*a")
    handle:close()

    return result ~= nil and string.find(result, name) ~= nil
end

function get_script_directory()
    local path = script_path()

    if path == nil or path == "" then
        return ""
    end

    return path:match("^(.*[\\/])")
end

function start_music_overlay()
    if is_process_running(process_name) then
        print("[MusicOverlay] Already running.")
        return
    end

    local dir = get_script_directory()

    if dir == nil or dir == "" then
        print("[MusicOverlay] Cannot detect script directory.")
        return
    end

    local exe_path = dir .. process_name

    local command =
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath \'' ..
        exe_path ..
        '\' -WorkingDirectory \'' ..
        dir ..
        '\'"'

    os.execute(command)

    print("[MusicOverlay] Started: " .. exe_path)
    print("[MusicOverlay] WorkingDirectory: " .. dir)
end

function script_load(settings)
    start_music_overlay()
end