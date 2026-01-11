# Tom's Local Run Notes

These are the quick steps I use on macOS to run the app from source.

## One-time setup (local venv)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.json config.json
```

## Run the app

Standard run:

```bash
python app.py
```

If you want the Python.app/Tk window (macOS framework build), use:

```bash
./.venv/bin/python.app/Contents/MacOS/python app.py
```

If that path does not exist, try:

```bash
pythonw app.py
```

Then open `http://localhost:8989` in your browser.
