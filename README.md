Kompas

Lokální běh bez mocků a bez demo dat
1) Nakopíruj `.env.example` do `.env` a případně uprav hodnoty.

2) Spusť komplet vývojové prostředí v Dockeru (Supabase + frontend build):
	- docker compose up --build

   *Front-end se servíruje na http://127.0.0.1:8080, Supabase API na http://127.0.0.1:54321, Studio na http://127.0.0.1:54323.*

3) Migrace se aplikují automaticky pomocí služby `migrations`. Pokud potřebuješ ruční push, můžeš spustit:
	- docker compose run --rm migrations

4) Volitelně můžeš dál vyvíjet přes Vite dev server mimo Docker (hot reload):
	- npm run dev

Poznámky
- Přihlášení nyní vyžaduje reálné účty v auth.users; založ je přes migrace/RPC (admin_create_user) nebo Supabase Studio.
- Náhled jako uživatel funguje přes lokálníStorage klíč impersonateUserId (nastaví AdminPanel při kliknutí na Náhled u daného uživatele).
- Sdílení na úrovni odkazu (link_shares) je zahrnuto v RPC get_accessible_categories_with_permission a příjemce uvidí kategorii s badge na sdíleném odkazu.

Dev login (pohodlné přihlášení při lokálním vývoji)
- Přihlašovací formulář v dev režimu automaticky předvyplní admina: kost@adminreal.cz / milan123.
- Pokud lokální Auth (GoTrue) dočasně vrací „Database error querying schema“, UI v dev režimu použije fallback:
	- vytvoří krátkodobý JWT podepsaný VITE_SUPABASE_JWT_SECRET
	- nastaví session přímo v supabase-js
	- funguje pouze v dev a pouze pro admin účet ze seed migrace

Seedovaní uživatelé (migrace 20251018100000_seed_initial_users.sql)
- Admin: kost@adminreal.cz / milan123
- Členové: info@adminreal.cz / zuzana123, dvorak@adminreal.cz / david123, faktury@adminreal.cz / iveta123

Rychlé ověření E2E sdílení (lokální Supabase)
- Předpoklad: běží lokální Supabase (supabase start) a migrace jsou nasazené.
- Spusť skript, který založí data, nasdílí odkaz a ověří viditelnost:
	- npm run e2e:share
	- Očekávaný výstup: "SUCCESS: Zuzana can see the shared link via RPC and links select."
