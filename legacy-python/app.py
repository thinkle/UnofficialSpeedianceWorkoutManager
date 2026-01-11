from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory, Response
from api_client import SpeedianceClient
import json
import os
import sys
import webbrowser
from threading import Timer, Thread
import requests
from datetime import datetime, timedelta
try:
    import tkinter as tk
    from tkinter import scrolledtext
except Exception:
    tk = None
    scrolledtext = None
from urllib.parse import urlparse

# Determine if running as a script or frozen exe (PyInstaller)
if getattr(sys, 'frozen', False):
    # If frozen, use the temporary folder created by PyInstaller
    base_dir = sys._MEIPASS
    template_folder = os.path.join(base_dir, 'templates')
    static_folder = os.path.join(base_dir, 'static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    # If running as script, use default paths
    app = Flask(__name__)

app.secret_key = "speediance_secret_key" # For Flash Messages
client = SpeedianceClient()

# --- Media Caching Logic ---
# Define local cache path
# Use base_dir to ensure it works in exe mode (though usually we want cache outside the temp exe folder)
# For the cache, we actually want it next to the executable, not inside the temp folder
if getattr(sys, 'frozen', False):
    # If exe, store cache next to the exe file
    current_dir = os.path.dirname(sys.executable)
else:
    current_dir = app.root_path
    
CACHE_ROOT = os.path.join(current_dir, 'static', 'media_cache')

def get_cache_path(url):
    """Determines local path and subfolder based on URL extension."""
    parsed = urlparse(url)
    filename = os.path.basename(parsed.path)
    if not filename: return None, None

    ext = os.path.splitext(filename)[1].lower()
    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
        subfolder = 'images'
    elif ext in ['.mp4', '.mov', '.webm']:
        subfolder = 'videos'
    elif ext in ['.mp3', '.wav', '.aac']:
        subfolder = 'audio'
    else:
        subfolder = 'misc'
    
    return os.path.join(CACHE_ROOT, subfolder, filename), subfolder

@app.template_filter('local_cache')
def local_cache_filter(url, force=False):
    """Jinja filter to rewrite remote URLs to local proxy URLs."""
    if not url: return ""
    
    # Check if file exists locally
    local_path, _ = get_cache_path(url)
    if local_path and os.path.exists(local_path):
        return url_for('media_proxy', url=url)
    
    # If forced (e.g. on detail page), use proxy to trigger download
    if force:
        return url_for('media_proxy', url=url)
    
    # If not cached and not forced, return original URL to let browser fetch directly
    return url

def _extract_first_value(data, keys):
    if not isinstance(data, dict):
        return None
    for key in keys:
        if key in data:
            value = data.get(key)
            if value is not None and value != "":
                return value
    return None

def _parse_history_datetime(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        ts = float(value)
    elif isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if s.isdigit():
            ts = float(s)
        else:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S"):
                try:
                    return datetime.strptime(s, fmt)
                except Exception:
                    continue
            try:
                return datetime.fromisoformat(s.replace("Z", "+00:00"))
            except Exception:
                return None
    else:
        return None

    if ts > 1e12:
        ts /= 1000.0
    elif ts > 1e10:
        ts /= 1000.0
    try:
        return datetime.fromtimestamp(ts)
    except Exception:
        return None

def _format_history_datetime(value):
    dt = _parse_history_datetime(value)
    if not dt:
        return None
    try:
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return None

def _parse_history_date(value):
    dt = _parse_history_datetime(value)
    if not dt:
        return None
    try:
        return dt.date()
    except Exception:
        return None

def _format_number(value):
    try:
        num = float(value)
    except Exception:
        return str(value)
    if num.is_integer():
        return str(int(num))
    return f"{num:.1f}"

def _format_duration(entry):
    minute_keys = [
        "durationMinute",
        "durationMinutes",
        "durationMin",
        "durationMins",
        "duration_min",
        "duration_mins",
        "totalMinutes",
        "totalMinute",
    ]
    second_keys = [
        "duration",
        "durationSeconds",
        "durationSec",
        "totalSeconds",
        "totalTime",
        "timeSeconds",
        "trainingTime",
    ]
    minutes = _extract_first_value(entry, minute_keys)
    if minutes is not None:
        return f"{_format_number(minutes)} min"

    seconds = _extract_first_value(entry, second_keys)
    if seconds is None:
        return None
    try:
        seconds_val = float(seconds)
    except Exception:
        return str(seconds)
    if seconds_val > 1e5:
        seconds_val /= 1000.0
    minutes_val = seconds_val / 60.0
    if minutes_val >= 1:
        return f"{_format_number(minutes_val)} min"
    return f"{_format_number(seconds_val)} sec"

def _format_seconds_value(value):
    if value is None:
        return None
    try:
        seconds_val = float(value)
    except Exception:
        return str(value)
    if seconds_val > 1e5:
        seconds_val /= 1000.0
    minutes_val = seconds_val / 60.0
    if minutes_val >= 1:
        return f"{_format_number(minutes_val)} min"
    return f"{_format_number(seconds_val)} sec"

def _summarize_weight_detail(value):
    if not value:
        return None
    if not isinstance(value, str):
        value = str(value)
    parts = [p.strip() for p in value.split(",") if p.strip()]
    weights = []
    for part in parts:
        try:
            weights.append(float(part))
        except Exception:
            continue
    if not weights:
        return None
    min_w = min(weights)
    max_w = max(weights)
    if min_w == max_w:
        return _format_number(min_w)
    return f"{_format_number(min_w)}-{_format_number(max_w)}"

def _extract_history_entries(payload):
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        candidates = ["data", "items", "result", "workouts", "history", "entries", "sessions", "records"]
        for key in candidates:
            value = payload.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                for inner_key in candidates:
                    inner_value = value.get(inner_key)
                    if isinstance(inner_value, list):
                        return inner_value
        return [payload]
    return []

def _flatten_history_entries(entries):
    list_keys = [
        "records",
        "recordList",
        "trainingList",
        "trainingInfoList",
        "items",
        "sessions",
        "workouts",
        "list",
    ]
    flattened = []
    session_keys = ["id", "trainingId", "startTimestamp", "endTimestamp", "trainingTime"]
    for entry in entries:
        nested = None
        date_hint = None
        if isinstance(entry, dict):
            date_hint = _extract_first_value(entry, ["date", "day", "trainingDate", "recordDate"])
            for key in list_keys:
                value = entry.get(key)
                if isinstance(value, list) and value:
                    has_session_item = any(
                        isinstance(item, dict) and _extract_first_value(item, session_keys)
                        for item in value
                    )
                    if has_session_item or not _extract_first_value(entry, session_keys):
                        nested = value
                        break
        if nested:
            for item in nested:
                if isinstance(item, dict) and date_hint:
                    cloned = dict(item)
                    cloned.setdefault("date", date_hint)
                    flattened.append(cloned)
                else:
                    flattened.append(item)
        else:
            flattened.append(entry)
    return flattened

def _normalize_history_entries(entries, unit):
    unit_label = "lbs" if unit == 1 else "kg"
    normalized = []
    for entry in entries:
        if not isinstance(entry, dict):
            normalized.append({
                "title": str(entry),
                "performed_at": None,
                "device": None,
                "metrics": [],
                "raw_json": json.dumps(entry, indent=2),
                "detail_id": None,
                "sort_ts": 0,
            })
            continue

        title = _extract_first_value(entry, ["name", "workoutName", "templateName", "planName", "title"]) or "Workout"
        performed_at_value = _extract_first_value(entry, [
            "completedAt",
            "completed_at",
            "finishTime",
            "finish_time",
            "endTime",
            "end_time",
            "endTimestamp",
            "startTime",
            "start_time",
            "createTime",
            "createdAt",
            "timestamp",
            "ts",
            "date",
            "day",
            "recordDate",
        ])
        performed_at = _format_history_datetime(performed_at_value)
        performed_dt = _parse_history_datetime(performed_at_value)
        sort_ts = performed_dt.timestamp() if performed_dt else 0

        device_type = _extract_first_value(entry, ["deviceType", "device_type"])
        device_label = None
        if device_type is not None:
            if str(device_type) == "1":
                device_label = "Gym Monster"
            elif str(device_type) == "2":
                device_label = "Gym Pal"
            else:
                device_label = str(device_type)

        metrics = []
        duration = _format_duration(entry)
        if duration:
            metrics.append({"label": "Duration", "value": duration})

        calories = _extract_first_value(entry, ["calories", "calorie", "kcal", "burnCalories", "burningCalories", "totalCalories"])
        if calories is not None:
            metrics.append({"label": "Calories", "value": f"{_format_number(calories)} kcal"})

        volume = _extract_first_value(entry, ["totalCapacity", "totalVolume", "volume", "totalWeight", "totalWeights"])
        if volume is not None:
            metrics.append({"label": "Volume", "value": f"{_format_number(volume)} {unit_label}"})

        count = _extract_first_value(entry, [
            "actionNum",
            "exerciseCount",
            "movementCount",
            "setCount",
            "trainingCount",
            "actionTotalCount",
            "finishActionCount",
        ])
        if count is None:
            for key in ["actions", "actionList", "exercises", "exerciseList", "sets"]:
                if isinstance(entry.get(key), list):
                    count = len(entry.get(key))
                    break
        if count is not None:
            metrics.append({"label": "Exercises", "value": _format_number(count)})

        session_id = _extract_first_value(entry, ["sessionId", "session_id", "id", "workoutId", "trainingId"])
        if session_id is not None:
            metrics.append({"label": "Session ID", "value": str(session_id)})

        detail_id = _extract_first_value(entry, ["trainingId", "training_id", "id"])

        normalized.append({
            "title": title,
            "performed_at": performed_at,
            "device": device_label,
            "metrics": metrics,
            "raw_json": json.dumps(entry, indent=2),
            "detail_id": detail_id,
            "sort_ts": sort_ts,
        })

    normalized.sort(key=lambda item: item["sort_ts"], reverse=True)
    for item in normalized:
        item.pop("sort_ts", None)
    return normalized

@app.route('/media_proxy')
def media_proxy():
    """Downloads and serves media files locally."""
    remote_url = request.args.get('url')
    if not remote_url:
        return "No URL provided", 400

    local_path, subfolder = get_cache_path(remote_url)
    if not local_path:
        return redirect(remote_url) # Fallback if filename parsing fails

    filename = os.path.basename(local_path)

    # Serve from cache if exists
    if os.path.exists(local_path):
        size = os.path.getsize(local_path)
        print(f"[CACHE HIT] Served {filename} from disk. Saved {size/1024:.2f} KB of CDN traffic.")
        return send_from_directory(os.path.dirname(local_path), filename)

    # Download if missing
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Stream download
        print(f"[CACHE MISS] Downloading {filename} from CDN...")
        resp = requests.get(remote_url, stream=True, timeout=10)
        if resp.status_code == 200:
            with open(local_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            size = os.path.getsize(local_path)
            print(f"[DOWNLOAD] Saved {filename} ({size/1024:.2f} KB) to cache.")
            return send_from_directory(os.path.dirname(local_path), filename)
        else:
            # If download fails, redirect to original URL
            print(f"[ERROR] Failed to download {remote_url} (Status {resp.status_code})")
            return redirect(remote_url)
    except Exception as e:
        print(f"[ERROR] Cache download failed for {remote_url}: {e}")
        return redirect(remote_url)

@app.route('/')
def index():
    if not client.credentials.get("token"):
        return redirect(url_for('settings'))
    
    try:
        workouts = client.get_user_workouts()
    except Exception as e:
        if str(e) == "Unauthorized":
            client.logout()
            flash("Session expired. Please login again.", "error")
            return redirect(url_for('settings'))
        flash("Error loading workouts. Invalid token?", "error")
        workouts = []
    
    unit = client.credentials.get('unit', 0)
    return render_template('index.html', workouts=workouts, unit=unit)

@app.route('/history')
def history():
    if not client.credentials.get("token"):
        return redirect(url_for('settings'))

    history_items = []
    history_error = None
    history_source = None
    unit = client.credentials.get('unit', 0)

    start_arg = request.args.get("start") or request.args.get("startDate") or request.args.get("start_date")
    end_arg = request.args.get("end") or request.args.get("endDate") or request.args.get("end_date")
    end_date = _parse_history_date(end_arg) or datetime.now().date()
    start_date = _parse_history_date(start_arg) or (end_date - timedelta(days=6))
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    start_date_str = start_date.isoformat()
    end_date_str = end_date.isoformat()

    try:
        history_source = f"{client.base_url}/api/mobile/v2/report/userTrainingDataRecord"
        payload = client.get_training_records(start_date_str, end_date_str)
        entries = _extract_history_entries(payload)
        entries = _flatten_history_entries(entries)
        history_items = _normalize_history_entries(entries, unit)
    except Exception as e:
        history_error = str(e)

    return render_template(
        'history.html',
        history_items=history_items,
        history_error=history_error,
        history_source=history_source,
        start_date=start_date_str,
        end_date=end_date_str,
    )

@app.route('/history/<int:training_id>')
def history_detail(training_id):
    if not client.credentials.get("token"):
        return redirect(url_for('settings'))

    unit = client.credentials.get('unit', 0)
    unit_label = "lbs" if unit == 1 else "kg"
    detail = None
    detail_error = None

    try:
        detail = client.get_ctt_training_info(training_id)
        if not detail:
            detail = client.get_training_info(training_id)
    except Exception as e:
        if str(e) == "Unauthorized":
            client.logout()
            flash("Session expired. Please login again.", "error")
            return redirect(url_for('settings'))
        detail_error = str(e)

    if not detail:
        detail = {"id": training_id}

    title = _extract_first_value(detail, ["templateName", "name", "title", "workoutName"]) or f"Workout {training_id}"
    start_value = _extract_first_value(detail, ["startTime", "startTimestamp", "start_time"])
    end_value = _extract_first_value(detail, ["endTime", "endTimestamp", "end_time"])
    duration = _format_duration(detail)

    metrics = []
    if duration:
        metrics.append({"label": "Duration", "value": duration})

    calories = _extract_first_value(detail, ["calorie", "calories"])
    if calories is not None:
        metrics.append({"label": "Calories", "value": f"{_format_number(calories)} kcal"})

    volume = _extract_first_value(detail, ["totalCapacity", "totalVolume", "totalWeight"])
    if volume is not None:
        metrics.append({"label": "Volume", "value": f"{_format_number(volume)} {unit_label}"})

    count = _extract_first_value(detail, ["trainingCount", "actionTotalCount", "finishActionCount"])
    if count is not None:
        metrics.append({"label": "Exercises", "value": _format_number(count)})

    device_type = _extract_first_value(detail, ["deviceType", "device_type"])
    device_label = None
    if device_type is not None:
        if str(device_type) == "1":
            device_label = "Gym Monster"
        elif str(device_type) == "2":
            device_label = "Gym Pal"
        else:
            device_label = str(device_type)

    exercises = (
        detail.get("cttActionLibraryTrainingInfoList")
        or detail.get("actionLibraryTrainingInfoList")
        or detail.get("actionList")
        or []
    )
    exercise_rows = []
    for exercise in exercises:
        if not isinstance(exercise, dict):
            exercise_rows.append({"name": str(exercise), "metrics": [], "sets": []})
            continue

        name = _extract_first_value(exercise, ["actionLibraryName", "name", "title"]) or "Exercise"
        row_metrics = []
        set_rows = []

        sets = _extract_first_value(exercise, ["finishGroupCount", "setCount"])
        reps_list = exercise.get("finishedReps")
        if sets is None and isinstance(reps_list, list):
            sets = len(reps_list)
        if sets is not None:
            row_metrics.append({"label": "Sets", "value": _format_number(sets)})

        weight = _extract_first_value(exercise, ["weight", "avgWeight", "maxWeight", "minWeight"])
        if weight is not None:
            row_metrics.append({"label": "Weight", "value": f"{_format_number(weight)} {unit_label}"})

        ex_duration = _format_duration(exercise)
        if ex_duration:
            row_metrics.append({"label": "Time", "value": ex_duration})

        ex_calories = _extract_first_value(exercise, ["calorie", "calories"])
        if ex_calories is not None:
            row_metrics.append({"label": "Calories", "value": f"{_format_number(ex_calories)} kcal"})

        ex_volume = _extract_first_value(exercise, ["totalCapacity", "capacity"])
        if ex_volume is not None:
            row_metrics.append({"label": "Volume", "value": f"{_format_number(ex_volume)} {unit_label}"})

        if isinstance(reps_list, list):
            for rep in reps_list:
                if not isinstance(rep, dict):
                    continue
                reps_done = _extract_first_value(rep, ["finishedCount", "reps", "count"])
                reps_target = _extract_first_value(rep, ["targetCount", "target", "targetTrainingCount"])
                reps_display = _format_number(reps_done) if reps_done is not None else "-"
                if reps_target is not None:
                    reps_display = f"{reps_display}/{_format_number(reps_target)}"

                time_display = _format_seconds_value(rep.get("time"))
                avg_weight = _extract_first_value(rep, ["avgWeight", "weight"])
                weight_detail_summary = None
                if avg_weight is None:
                    weight_detail_summary = _summarize_weight_detail(rep.get("weightDetail"))
                    avg_weight = weight_detail_summary
                if avg_weight is not None:
                    avg_weight = f"{_format_number(avg_weight)} {unit_label}"

                capacity = _extract_first_value(rep, ["capacity", "totalCapacity"])
                if capacity is not None:
                    capacity = f"{_format_number(capacity)} {unit_label}"

                set_rows.append({
                    "index": rep.get("ix"),
                    "reps": reps_display,
                    "time": time_display,
                    "avg_weight": avg_weight,
                    "weight_detail": f"{weight_detail_summary} {unit_label}" if weight_detail_summary else None,
                    "capacity": capacity,
                })

        exercise_rows.append({
            "name": name,
            "metrics": row_metrics,
            "sets": set_rows,
        })

    return render_template(
        'history_detail.html',
        training_id=training_id,
        title=title,
        start_time=_format_history_datetime(start_value),
        end_time=_format_history_datetime(end_value),
        device=device_label,
        metrics=metrics,
        exercises=exercise_rows,
        raw_json=json.dumps(detail, indent=2),
        detail_error=detail_error,
    )

@app.route('/settings', methods=['GET', 'POST'])
def settings():
    if request.method == 'POST':
        # Manual config save
        device_type = int(request.form.get('device_type', client.credentials.get('device_type', 1)))
        allow_monster_moves = bool(request.form.get('allow_monster_moves'))
        history_url = request.form.get('workout_history_url', '')
        history_key = request.form.get('workout_history_api_key', '')
        history_header = request.form.get('workout_history_api_key_header', '')
        client.save_config(
            request.form['user_id'], 
            request.form['token'], 
            request.form.get('region', 'Global'),
            int(request.form.get('unit', 0)),
            request.form.get('custom_instruction', ''),
            device_type,
            allow_monster_moves,
            history_url,
            history_key,
            history_header,
        )
        flash("Settings saved!", "success")
        return redirect(url_for('index'))
    
    creds = client.load_config()
    return render_template('settings.html', creds=creds)

@app.route('/settings/custom_instruction', methods=['POST'])
def update_custom_instruction():
    data = request.json
    instruction = data.get('instruction', '')
    
    # Update only the instruction, keep other settings
    creds = client.credentials
    client.save_config(
        creds.get('user_id'), 
        creds.get('token'), 
        creds.get('region'),
        creds.get('unit', 0),
        instruction,
        creds.get('device_type', 1),
        creds.get('allow_monster_moves', False),
    )
    return jsonify({"status": "success"})

@app.route('/settings/unit', methods=['POST'])
def update_unit():
    unit = request.form.get('unit')
    success, msg = client.update_unit(unit)
    if success:
        flash("Unit preference updated!", "success")
    else:
        flash(f"Error updating unit: {msg}", "error")
    return redirect(url_for('settings'))

@app.route('/settings/device', methods=['POST'])
def update_device():
    device_type = int(request.form.get('device_type', client.credentials.get('device_type', 1)))
    allow_monster_moves = bool(request.form.get('allow_monster_moves'))
    creds = client.credentials
    client.save_config(
        creds.get('user_id'),
        creds.get('token'),
        creds.get('region'),
        creds.get('unit', 0),
        creds.get('custom_instruction', ''),
        device_type,
        allow_monster_moves,
    )
    client.library_cache = None
    if os.path.exists(client.library_cache_file):
        try:
            os.remove(client.library_cache_file)
        except Exception as e:
            print(f"Error removing cache file: {e}")
    flash("Device settings updated!", "success")
    return redirect(url_for('settings'))

@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email')
    password = request.form.get('password')
    region = request.form.get('region', 'Global')
    
    if not email or not password:
        flash("Email and password required", "error")
        return redirect(url_for('settings'))
    
    # Update client region before login attempt
    client.region = region
    client.host = "euapi.speediance.com" if region == "EU" else "api2.speediance.com"
    client.base_url = "https://" + client.host
        
    success, message, debug_info = client.login(email, password)
    if success:
        flash("Login successful!", "success")
        return redirect(url_for('index'))
    else:
        flash(message, "error")
        if debug_info:
            flash(debug_info, "debug")
        return redirect(url_for('settings'))

@app.route('/logout')
def logout():
    client.logout()
    flash("Logged out successfully", "success")
    return redirect(url_for('settings'))

@app.route('/settings/preload')
def preload_assets():
    """Streamed response that downloads all assets."""
    if not client.credentials.get("token"): return "Unauthorized", 401

    def download_url(url):
        if not url or not url.startswith('http'): return "Skipped (Invalid URL)"
        
        local_path, subfolder = get_cache_path(url)
        if not local_path: return "Skipped (Path error)"
        
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            return "Skipped (Already exists)"
            
        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            resp = requests.get(url, stream=True, timeout=20)
            if resp.status_code == 200:
                with open(local_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                return "Downloaded"
            else:
                return f"Failed (Status {resp.status_code})"
        except Exception as e:
            return f"Error: {e}"

    def extract_urls_from_exercise(ex):
        urls = set()
        if ex.get('img'): urls.add(ex['img'])
        
        # Variants
        for variant in ex.get('actionLibraryList', []):
            if variant.get('videoPath'): urls.add(variant['videoPath'])
            if variant.get('leftVideo'): urls.add(variant['leftVideo'])
            if variant.get('rightVideo'): urls.add(variant['rightVideo'])
            if variant.get('endVideo'): urls.add(variant['endVideo'])
            
            if variant.get('startVideo'):
                for v in variant['startVideo'].split(','):
                    if v.strip(): urls.add(v.strip())
            
            if variant.get('coach', {}).get('avatar'):
                urls.add(variant['coach']['avatar'])
                
            for key in ['actionNameVoice', 'completionTimeVoice', 'completionNumberVoice', 'goVoice', 'restConfigVoice']:
                if variant.get(key): urls.add(variant[key])
            
            for i in range(1, 7):
                key = f'guideVoice{i}'
                if variant.get(key): urls.add(variant[key])

        # Steps
        try:
            if ex.get('showDetails'):
                steps = json.loads(ex['showDetails'])
                for step in steps:
                    if step.get('img'): urls.add(step['img'])
        except:
            pass
        return urls

    def generate():
        yield "Starting deep discovery and download of assets...\n"
        yield "This process fetches full details for every exercise to ensure no video is missed.\n"
        yield "It may take several minutes. Please do not close this tab.\n\n"
        
        # 1. Accessories
        yield "--- Processing Accessories ---\n"
        try:
            accessories = client.get_accessories()
            for acc in accessories:
                if acc.get('img'): 
                    res = download_url(acc['img'])
                    yield f"Accessory {acc.get('name', 'Unknown')}: {res}\n"
        except Exception as e:
            yield f"Error scanning accessories: {e}\n"

        # 2. Library
        yield "\n--- Processing Exercise Library ---\n"
        try:
            # Get the list of groups first
            library_groups = client.get_library()
            total_groups = len(library_groups)
            
            for i, group in enumerate(library_groups):
                group_id = group.get('id')
                group_title = group.get('title', f'ID {group_id}')
                yield f"[{i+1}/{total_groups}] Processing: {group_title} ... "
                
                # Fetch FULL details for this exercise group
                # This ensures we get all variants and videos even if the list endpoint was incomplete
                try:
                    detail = client.get_exercise_detail(group_id)
                    if not detail:
                        yield "Failed to fetch details.\n"
                        continue
                        
                    urls = extract_urls_from_exercise(detail)
                    yield f"Found {len(urls)} assets.\n"
                    
                    for url in urls:
                        filename = os.path.basename(urlparse(url).path)
                        res = download_url(url)
                        if "Downloaded" in res:
                            yield f"    -> {filename}: {res}\n"
                            
                except Exception as e:
                    yield f"Error fetching details: {e}\n"
                    
        except Exception as e:
            yield f"Error scanning library: {e}\n"
        
        yield "\nDone! All assets have been processed."

    return Response(generate(), mimetype='text/plain')

@app.route('/library')
def library():
    if not client.credentials.get("token"): return redirect(url_for('settings'))
    try:
        exercises = client.get_library()
        accessories = client.get_accessories()
        categories = client.get_categories()
    except Exception as e:
        if str(e) == "Unauthorized":
            client.logout()
            flash("Session expired. Please login again.", "error")
            return redirect(url_for('settings'))
        flash(f"Error loading library: {e}", "error")
        exercises = []
        accessories = []
        categories = []

    accessory_map = {str(acc['id']): acc['name'] for acc in accessories}
    
    # Enrich exercises with equipment names
    for ex in exercises:
        acc_ids = str(ex.get('accessories', '')).split(',')
        names = [accessory_map.get(aid, 'Standard') for aid in acc_ids if aid]
        ex['equipment_name'] = ', '.join(names) if names else 'Standard'
        
    return render_template(
        'library.html',
        exercises=exercises,
        categories=categories,
        device_type=client.device_type,
        allow_monster_moves=client.allow_monster_moves,
    )

@app.route('/library/refresh')
def refresh_library():
    if not client.credentials.get("token"): return redirect(url_for('settings'))
    
    # Clear memory and disk cache
    client.library_cache = None
    if os.path.exists(client.library_cache_file):
        try:
            os.remove(client.library_cache_file)
        except Exception as e:
            print(f"Error removing cache file: {e}")
            
    flash("Library cache cleared. Reloading from server...", "info")
    return redirect(url_for('library'))

@app.route('/exercise/<int:ex_id>')
def exercise_detail(ex_id):
    if not client.credentials.get("token"): return redirect(url_for('settings'))
    
    # 1. Load details
    detail = client.get_exercise_detail(ex_id)
    
    # 2. Resolve accessories (IDs -> Objects with Image/Name)
    all_accessories = client.get_accessories()
    required_ids = detail.get('accessories', '').split(',')
    
    mapped_accessories = []
    for acc in all_accessories:
        # Check if the ID is in the required list
        if str(acc['id']) in required_ids:
            mapped_accessories.append(acc)
            
    # 3. "showDetails" is a JSON string in the API response, we need to parse it
    # Format: [{"context": "Text...", "img": "url..."}, ...]
    try:
        if detail.get('showDetails'):
            detail['steps'] = json.loads(detail['showDetails'])
        else:
            detail['steps'] = []
    except Exception as e:
        print(f"JSON Parse Error: {e}")
        detail['steps'] = []

    return render_template('exercise_detail.html', ex=detail, accessories=mapped_accessories)

@app.route('/api/exercise/<int:ex_id>')
def api_exercise_detail(ex_id):
    """Returns details as JSON for the frontend (dropdowns)"""
    if not client.credentials.get("token"): 
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Uses the existing cache/request
        detail = client.get_exercise_detail(ex_id)
        return jsonify(detail)
    except Exception as e:
        if str(e) == "Unauthorized":
            return jsonify({"error": "Unauthorized"}), 401
        return jsonify({"error": str(e)}), 500

@app.route('/api/calendar')
def api_calendar():
    """Returns calendar data for a specific month."""
    if not client.credentials.get("token"):
        return jsonify({"error": "Unauthorized"}), 401
    
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Missing date parameter"}), 400
        
    try:
        data = client.get_calendar_month(date_str)
        return jsonify(data)
    except Exception as e:
        if str(e) == "Unauthorized":
            return jsonify({"error": "Unauthorized"}), 401
        return jsonify({"error": str(e)}), 500

@app.route('/api/schedule', methods=['POST'])
def api_schedule():
    """Schedules or unschedules a workout."""
    if not client.credentials.get("token"):
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    date_str = data.get('date')
    template_code = data.get('templateCode')
    status = data.get('status')
    
    if not date_str or not template_code or status is None:
        return jsonify({"error": "Missing parameters"}), 400
        
    try:
        success = client.schedule_workout(date_str, template_code, status)
        return jsonify({"success": success})
    except Exception as e:
        if str(e) == "Unauthorized":
            return jsonify({"error": "Unauthorized"}), 401
        return jsonify({"error": str(e)}), 500

@app.route('/debug/last_response')
def debug_last_response():
    """Returns the last API request/response info for debugging."""
    return jsonify(client.last_debug_info)

@app.route('/edit/<string:code>')  # HERE: string instead of int
def edit(code):
    if not client.credentials.get("token"): return redirect(url_for('settings'))
    
    try:
        # Load workout details via code
        workout = client.get_workout_detail(code)
        library = client.get_library()
        categories = client.get_categories()
        accessories = client.get_accessories()
    except Exception as e:
        if str(e) == "Unauthorized":
            client.logout()
            flash("Session expired. Please login again.", "error")
            return redirect(url_for('settings'))
        flash(f"Error loading data: {e}", "error")
        return redirect(url_for('index'))
    
    if not workout:
        flash("Could not load workout details.", "error")
        return redirect(url_for('index'))

    accessory_map = {str(acc['id']): acc['name'] for acc in accessories}
    for ex in library:
        acc_ids = str(ex.get('accessories', '')).split(',')
        names = [accessory_map.get(aid, 'Standard') for aid in acc_ids if aid]
        ex['equipment_name'] = ', '.join(names) if names else 'Standard'

    unit = client.credentials.get("unit", 0)
    custom_instruction = client.credentials.get("custom_instruction", "")
    return render_template(
        'create.html',
        library=library,
        existing_workout=workout,
        unit=unit,
        custom_instruction=custom_instruction,
        categories=categories,
        device_type=client.device_type,
        allow_monster_moves=client.allow_monster_moves,
    )


@app.route('/create', methods=['GET', 'POST'])
def create():
    if not client.credentials.get("token"): return redirect(url_for('settings'))
    
    if request.method == 'POST':
        data = request.json 
        name = data.get('name')
        exercises = data.get('exercises')
        template_id = data.get('id') 
        
        try:
            result = client.save_workout(name, exercises, template_id)
            if result.get('code') == 0:
                return jsonify({"status": "success"})
            else:
                return jsonify({"status": "error", "message": result.get('message')})
        except Exception as e:
            if str(e) == "Unauthorized":
                return jsonify({"status": "error", "message": "Session expired. Please login again."}), 401
            return jsonify({"status": "error", "message": str(e)})

    try:
        library = client.get_library()
        categories = client.get_categories()
        accessories = client.get_accessories()
    except Exception as e:
        if str(e) == "Unauthorized":
            client.logout()
            flash("Session expired. Please login again.", "error")
            return redirect(url_for('settings'))
        library = []
        categories = []
        accessories = []

    accessory_map = {str(acc['id']): acc['name'] for acc in accessories}
    for ex in library:
        acc_ids = str(ex.get('accessories', '')).split(',')
        names = [accessory_map.get(aid, 'Standard') for aid in acc_ids if aid]
        ex['equipment_name'] = ', '.join(names) if names else 'Standard'

    unit = client.credentials.get("unit", 0)
    custom_instruction = client.credentials.get("custom_instruction", "")
    
    # HERE: We pass 'None' so the template knows: "No data to preload"
    # This has NO influence on the edit route, which sends its own data.
    return render_template(
        'create.html',
        library=library,
        existing_workout=None,
        unit=unit,
        custom_instruction=custom_instruction,
        categories=categories,
        device_type=client.device_type,
        allow_monster_moves=client.allow_monster_moves,
    )

@app.route('/delete/<int:id>')
def delete(id):
    client.delete_workout(id)
    flash("Workout deleted.", "info")
    return redirect(url_for('index'))

class TextRedirector(object):
    def __init__(self, widget, tag="stdout"):
        self.widget = widget
        self.tag = tag

    def write(self, str):
        try:
            self.widget.configure(state="normal")
            self.widget.insert("end", str, (self.tag,))
            self.widget.see("end")
            self.widget.configure(state="disabled")
        except:
            pass
    
    def flush(self):
        pass

def open_browser():
    webbrowser.open_new("http://127.0.0.1:8989")

def run_flask_server():
    try:
        app.run(debug=False, port=8989, host='0.0.0.0', use_reloader=False)
    except Exception as e:
        print(f"Error starting server: {e}")

def start_gui():
    if tk is None:
        print("Tkinter is not available; starting Flask server without GUI.")
        run_flask_server()
        return
    root = tk.Tk()
    root.title("Unofficial Speediance Workout Manager Server")
    root.geometry("700x500")
    
    lbl = tk.Label(root, text="Unofficial Speediance Workout Manager is running.\nDo not close this window while using the app.", font=("Arial", 10), pady=10)
    lbl.pack()

    btn_frame = tk.Frame(root)
    btn_frame.pack(pady=5)

    btn_open = tk.Button(btn_frame, text="Open in Browser", command=open_browser, bg="#4CAF50", fg="white", font=("Arial", 10, "bold"), padx=10, pady=5)
    btn_open.pack(side=tk.LEFT, padx=10)

    def on_close():
        root.destroy()
        sys.exit(0)

    btn_close = tk.Button(btn_frame, text="Stop Server & Exit", command=on_close, bg="#f44336", fg="white", font=("Arial", 10, "bold"), padx=10, pady=5)
    btn_close.pack(side=tk.LEFT, padx=10)

    log_frame = tk.Frame(root)
    log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
    
    tk.Label(log_frame, text="Server Logs:", anchor="w").pack(fill=tk.X)
    
    text_area = scrolledtext.ScrolledText(log_frame, state='disabled', font=("Consolas", 9))
    text_area.pack(fill=tk.BOTH, expand=True)
    
    sys.stdout = TextRedirector(text_area, "stdout")
    sys.stderr = TextRedirector(text_area, "stderr")

    root.protocol("WM_DELETE_WINDOW", on_close)

    t = Thread(target=run_flask_server, daemon=True)
    t.start()

    Timer(2.0, open_browser).start()

    root.mainloop()

if __name__ == '__main__':
    if getattr(sys, 'frozen', False):
        start_gui()
    else:
        app.run(debug=True, port=8989, host='0.0.0.0')
