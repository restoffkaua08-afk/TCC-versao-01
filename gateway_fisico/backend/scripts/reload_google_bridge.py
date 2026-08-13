import importlib, sys
from pathlib import Path

# ensure backend root is on sys.path so 'app' package can be imported
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

try:
    m = importlib.import_module('app.google_sheets_bridge')
    importlib.reload(m)
    print('import ok')
except Exception as e:
    print('import error', e)
    import traceback
    traceback.print_exc()
    sys.exit(1)
