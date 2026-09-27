-- ============================================================================
-- FourKingdom (Alpha v0.1) — Esquema Maestro de Base de Datos para Supabase
-- Sistema gobernado por Backend con RLS, Tablas Relacionales y Triggers
-- ============================================================================

-- Habilitar extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: REINOS / PERFILES DE JUGADOR (kingdoms)
CREATE TABLE IF NOT EXISTS public.kingdoms (
    id TEXT PRIMARY KEY,
    username TEXT DEFAULT 'Lord Conquistador',
    coord_x INTEGER DEFAULT 4,
    coord_y INTEGER DEFAULT -3,
    power INTEGER DEFAULT 300,
    wood INTEGER DEFAULT 1500,
    stone INTEGER DEFAULT 1500,
    food INTEGER DEFAULT 1800,
    king_claimed NUMERIC(12, 2) DEFAULT 120.00,
    king_pending NUMERIC(12, 4) DEFAULT 0.0000,
    king_vault NUMERIC(12, 2) DEFAULT 0.00,
    buildings JSONB DEFAULT '{"castle": 1, "barracks": 0, "granary": 0, "treasury": 0, "wall": 0}'::jsonb,
    troops JSONB DEFAULT '{"infantry": 10, "archer": 0, "cavalry": 0}'::jsonb,
    shield_until BIGINT DEFAULT 0,
    clan_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: REPORTES (reports) — Recolección, NPC, PvP, Bastiones y Refuerzos
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES public.kingdoms(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('gather', 'npc', 'pvp', 'fortress', 'capital', 'reinforce', 'combat')),
    target_name TEXT NOT NULL,
    target_x INTEGER,
    target_y INTEGER,
    result TEXT NOT NULL,
    is_victory BOOLEAN DEFAULT true,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: MARCHAS ACTIVAS (marches)
CREATE TABLE IF NOT EXISTS public.marches (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES public.kingdoms(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('gather', 'npc', 'pvp', 'fortress', 'capital', 'reinforce')),
    target_x INTEGER NOT NULL,
    target_y INTEGER NOT NULL,
    target_name TEXT NOT NULL,
    army JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('traveling', 'gathering', 'stationed', 'returning')),
    arrive_time TIMESTAMP WITH TIME ZONE NOT NULL,
    return_time TIMESTAMP WITH TIME ZONE,
    loot JSONB DEFAULT '{"wood": 0, "stone": 0, "food": 0}'::jsonb,
    king_loot NUMERIC(8, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: CLANES (clans)
CREATE TABLE IF NOT EXISTS public.clans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    tag TEXT NOT NULL UNIQUE,
    level INTEGER DEFAULT 1,
    members_count INTEGER DEFAULT 1,
    max_members INTEGER DEFAULT 30,
    leader_id TEXT NOT NULL,
    description TEXT,
    vault_king NUMERIC(12, 2) DEFAULT 0.00,
    donations JSONB DEFAULT '{"wood": 0, "stone": 0}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA: MIEMBROS DE CLAN (clan_members)
CREATE TABLE IF NOT EXISTS public.clan_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clan_id TEXT NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES public.kingdoms(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'Miembro' CHECK (role IN ('Líder', 'Oficial', 'Miembro')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(clan_id, player_id)
);

-- 6. TABLA: RALLIES DE CLAN (clan_rallies)
CREATE TABLE IF NOT EXISTS public.clan_rallies (
    id TEXT PRIMARY KEY,
    clan_id TEXT NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES public.kingdoms(id) ON DELETE CASCADE,
    target_x INTEGER NOT NULL,
    target_y INTEGER NOT NULL,
    target_name TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_level INTEGER DEFAULT 1,
    status TEXT DEFAULT 'gathering' CHECK (status IN ('gathering', 'launched', 'resolved', 'cancelled')),
    total_army JSONB DEFAULT '{"infantry": 0, "archer": 0, "cavalry": 0}'::jsonb,
    participants JSONB DEFAULT '[]'::jsonb,
    launch_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ÍNDICES PARA ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_reports_player_id ON public.reports(player_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marches_player_id ON public.marches(player_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_player ON public.clan_members(player_id);
CREATE INDEX IF NOT EXISTS idx_clan_rallies_clan ON public.clan_rallies(clan_id);

-- POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
ALTER TABLE public.kingdoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_rallies ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura abiertas para la Alpha con clave pública / anon
CREATE POLICY "Permitir acceso a reinos" ON public.kingdoms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a reportes" ON public.reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a marchas" ON public.marches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a clanes" ON public.clans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a miembros" ON public.clan_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a rallies" ON public.clan_rallies FOR ALL USING (true) WITH CHECK (true);

-- HABILITAR REALTIME EN REPORTES, REINOS Y MARCHAS
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kingdoms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_rallies;
