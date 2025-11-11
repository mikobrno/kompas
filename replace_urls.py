#!/usr/bin/env python
# -*- coding: utf-8 -*-
import re

# Čti seed_cloud.sql
with open('supabase/seed_cloud.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Nahradí všechny URL (http:// nebo https://) s čímkoli v nich
# Vzor: 'http://xxx' nebo 'https://xxx' -> 'http://onlinekompas.cz/'
pattern = r"'https?://[^']*'"
replacement = "'http://onlinekompas.cz/'"
content = re.sub(pattern, replacement, content)

# Zapiš zpět
with open('supabase/seed_cloud.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Všechny URL byly nahrazeny na http://onlinekompas.cz/')
