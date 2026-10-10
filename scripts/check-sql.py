"""Syntax only. Requires pglast; never connects to PostgreSQL or executes SQL."""
from pathlib import Path
from pglast import parse_sql, parse_plpgsql

for path in sorted(Path('supabase/migrations').glob('*.sql')):
    text = path.read_text()
    statements = parse_sql(text)
    functions = 0
    for raw in statements:
        statement = text[raw.stmt_location:raw.stmt_location + raw.stmt_len] if raw.stmt_len else text[raw.stmt_location:]
        if raw.stmt.__class__.__name__ == 'CreateFunctionStmt' and 'language plpgsql' in statement.lower():
            parse_plpgsql(statement)
            functions += 1
        elif raw.stmt.__class__.__name__ == 'DoStmt':
            parse_plpgsql(statement)
    print(f'{path}: SQL syntax OK, {functions} PL/pgSQL functions parsed; NOT executed')
