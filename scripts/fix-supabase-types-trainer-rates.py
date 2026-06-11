#!/usr/bin/env python3
"""
Insert contracted_hourly_rate + extra_hours_rate into trainer_profiles
Row/Insert/Update sections of the generated Supabase type files.

Strategy:
  1. Find the trainer_profiles block (start: 'trainer_profiles: {', end: matching '};')
  2. Within that block only, do scoped string replacements
  3. 6 replacements total: 3 per file (Row/Insert/Update) for each of the 2 new fields
"""

import re
import sys

FILES = ['supabase-types.ts', 'types/supabase.ts']

REPLACEMENTS = [
    # contracted_hourly_rate — after club_id, before created_at (alphabetical)
    (
        '          club_id: string;\n          created_at: string;',
        '          club_id: string;\n          contracted_hourly_rate: number | null;\n          created_at: string;',
    ),  # Row
    (
        '          club_id: string;\n          created_at?: string;',
        '          club_id: string;\n          contracted_hourly_rate?: number | null;\n          created_at?: string;',
    ),  # Insert
    (
        '          club_id?: string;\n          created_at?: string;',
        '          club_id?: string;\n          contracted_hourly_rate?: number | null;\n          created_at?: string;',
    ),  # Update
    # extra_hours_rate — after experience, before first_name (alphabetical)
    (
        '          experience: Json;\n          first_name: string;',
        '          experience: Json;\n          extra_hours_rate: number | null;\n          first_name: string;',
    ),  # Row
    (
        '          experience?: Json;\n          first_name: string;',
        '          experience?: Json;\n          extra_hours_rate?: number | null;\n          first_name: string;',
    ),  # Insert
    (
        '          experience?: Json;\n          first_name?: string;',
        '          experience?: Json;\n          extra_hours_rate?: number | null;\n          first_name?: string;',
    ),  # Update
]


def find_trainer_profiles_block(content):
    start_match = re.search(r'trainer_profiles:\s*\{', content)
    if not start_match:
        return None
    start = start_match.start()
    depth = 0
    i = start_match.end() - 1
    while i < len(content):
        c = content[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return None


def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    span = find_trainer_profiles_block(content)
    if not span:
        print(f"  SKIP {filepath}: trainer_profiles block not found")
        return False
    start, end = span
    block = content[start:end]

    new_block = block
    applied = 0
    for old, new in REPLACEMENTS:
        if old in new_block:
            new_block = new_block.replace(old, new, 1)
            applied += 1
        else:
            print(f"  WARN {filepath}: pattern not found: {old[:60]!r}")

    if applied == 0:
        print(f"  FAIL {filepath}: no patterns applied")
        return False

    new_content = content[:start] + new_block + content[end:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"  OK   {filepath}: {applied}/6 patterns applied")
    return True


def main():
    overall_ok = True
    for fp in FILES:
        process_file(fp)
    return 0


if __name__ == '__main__':
    sys.exit(main())
