# Kompas - Lokální testování

## ✅ Databáze připravena

- Supabase běží na: http://127.0.0.1:54321
- Studio: http://127.0.0.1:54323
- Migrace aplikovány včetně opravy RLS rekurze

## Přihlášení

**Email:** admin@kompas.cz  
**Heslo:** admin123

*(již předvyplněno vLoginForm)*

## Co bylo opraveno

1. **RLS infinite recursion** – policies na tabulce `categories` byly přepsány bez rekurzivních dotazů na `users`.
2. **Admin role** – uživatel admin@kompas.cz povýšen na roli `admin` v DB.
3. **Auto-seed** – po prvním přihlášení se automaticky vytvoří:
   - Kategorie "Moje první kategorie"
   - 2 ukázkové odkazy (Supabase Docs, GitHub)
   - Připnutý odkaz v horní liště
   - Tag "důležité"

## Aktuální stav

- ✅ Lokální DB běží
- ✅ Migrace aplikovány
- ✅ RLS policies opraveny
- ✅ Admin účet připraven
- ✅ Auto-seed aktivní (dev only)

## Jak testovat

1. Otevřete http://localhost:5174/
2. Přihlaste se (předvyplněno)
3. Klikněte "Nová kategorie" nebo využijte auto-seed data

Pokud se objeví chyba, zkontrolujte Browser Console a Network panel pro konkrétní chybovou hlášku z DB.
