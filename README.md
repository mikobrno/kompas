Kompas

Lokální běh bez mocků a bez demo dat
1) Nastav .env.local (nebo exportuj proměnné při spuštění):
	- VITE_SUPABASE_URL=http://127.0.0.1:54321
	- VITE_SUPABASE_ANON_KEY=<ANON KEY ZE SUPABASE>
	- VITE_SUPABASE_JWT_SECRET=<JWT SECRET ZE SUPABASE>

2) Spusť Docker služby (DB + web dev):
	- docker compose up -d supabase
	- docker compose up kompas-web-dev

3) Aplikuj migrace do lokální DB (doporučeno Supabase CLI nebo psql):
	- supabase db push
	nebo
	- psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/<soubor>.sql

4) Spusť web lokálně bez demo/autoseed (žádná mock data nejsou používána).
	- npm run dev

Poznámky
- Přihlášení nyní vyžaduje reálné účty v auth.users; založ je přes migrace/RPC (admin_create_user) nebo Supabase Studio.
- Náhled jako uživatel funguje přes lokálníStorage klíč impersonateUserId (nastaví AdminPanel při kliknutí na Náhled u daného uživatele).
- Sdílení na úrovni odkazu (link_shares) je zahrnuto v RPC get_accessible_categories_with_permission a příjemce uvidí kategorii s badge na sdíleném odkazu.

Dev login (pohodlné přihlášení při lokálním vývoji)
- Přihlašovací formulář v dev režimu automaticky předvyplní admina: milan@example.com / milan123.
- Pokud lokální Auth (GoTrue) dočasně vrací „Database error querying schema“, UI v dev režimu použije fallback:
	- vytvoří krátkodobý JWT podepsaný VITE_SUPABASE_JWT_SECRET
	- nastaví session přímo v supabase-js
	- funguje pouze v dev a pouze pro admin účet ze seed migrace

Rychlé ověření E2E sdílení (lokální Supabase)
- Předpoklad: běží lokální Supabase (supabase start) a migrace jsou nasazené.
- Spusť skript, který založí data, nasdílí odkaz a ověří viditelnost:
	- npm run e2e:share
	- Očekávaný výstup: "SUCCESS: Zuzana can see the shared link via RPC and links select."
