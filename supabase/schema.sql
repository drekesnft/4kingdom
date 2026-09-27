-- ============================================================================
-- FourKingdom (Alpha v0.1) — Esquema Maestro de Base de Datos para Supabase
-- Sistema gobernado por Backend con RLS, Tablas Relacionales y Triggers
-- ============================================================================

-- Habilitar extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. TABLA: CUENTAS DE USUARIO Y AUTENTICACIÓN (user_accounts)
CREATE TABLE IF NOT EXISTS public.user_accounts (
    email TEXT PRIMARY KEY,
    temp_password TEXT,
    password_hash TEXT NOT NULL,
    must_change_password BOOLEAN DEFAULT TRUE,
    role TEXT DEFAULT 'alpha_player', -- 'alpha_player' o 'whitelist'
    provider TEXT DEFAULT 'email', -- 'email' o 'google'
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    referrals_count INTEGER DEFAULT 0,
    airdrop_tokens INTEGER DEFAULT 0,
    assigned_kingdom TEXT,
    base_coord JSONB,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed de cuenta de prueba asignada Alpha: antoniox4253@gmail.com con clave k9t4m y código de referido propio
INSERT INTO public.user_accounts (email, temp_password, password_hash, must_change_password, role, referral_code)
VALUES ('antoniox4253@gmail.com', 'k9t4m', 'k9t4m', true, 'alpha_player', 'FK-ANTO-77')
ON CONFLICT (email) DO UPDATE SET referral_code = 'FK-ANTO-77';

-- 0.1 TABLA: PRE-REGISTROS Y WHITELIST (whitelist_signups)
CREATE TABLE IF NOT EXISTS public.whitelist_signups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by TEXT,
    provider TEXT DEFAULT 'google',
    airdrop_tokens INTEGER DEFAULT 0,
    referrals_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 0.2 TABLA: REGISTRO DE REFERIDOS Y AIRDROP (referrals)
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_code TEXT NOT NULL,
    referrer_email TEXT NOT NULL,
    referred_email TEXT NOT NULL UNIQUE,
    tokens_rewarded INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
    king_claimed NUMERIC(12, 2) DEFAULT 10.00,
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
-- 7. TABLA: HISTORIAL DE PAGOS DE RANKING DIARIO (ranking_payouts)
-- Ejecutado diariamente a las 00:00 UTC a partir del 29/09/2026
CREATE TABLE IF NOT EXISTS public.ranking_payouts (
    id TEXT PRIMARY KEY,
    payout_date DATE NOT NULL,
    payout_time_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    total_pool NUMERIC(12, 2) NOT NULL DEFAULT 40.00,
    winners JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ÍNDICES PARA ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_reports_player_id ON public.reports(player_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marches_player_id ON public.marches(player_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_player ON public.clan_members(player_id);
CREATE INDEX IF NOT EXISTS idx_clan_rallies_clan ON public.clan_rallies(clan_id);
CREATE INDEX IF NOT EXISTS idx_ranking_payouts_date ON public.ranking_payouts(payout_date);

-- POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kingdoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_rallies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_payouts ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura abiertas para la Alpha con clave pública / anon
CREATE POLICY "Permitir acceso a cuentas" ON public.user_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a reinos" ON public.kingdoms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a reportes" ON public.reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a marchas" ON public.marches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a clanes" ON public.clans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a miembros" ON public.clan_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a rallies" ON public.clan_rallies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso a ranking_payouts" ON public.ranking_payouts FOR ALL USING (true) WITH CHECK (true);

-- HABILITAR REALTIME EN REPORTES, REINOS, MARCHAS, CUENTAS Y RANKINGS
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kingdoms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_rallies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ranking_payouts;

-- ============================================================================
-- PROCEDIMIENTO: DISTRIBUCIÓN AUTOMÁTICA DEL RANKING DIARIO (00:00 UTC DESDE 29/09/2026)
-- Suma real auditada en backend: Top 1 (37.5%), Top 2 (25%), Top 3 (17.5%), Top 4 (12.5%), Top 5 (7.5%)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.distribute_daily_ranking_rewards()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
    v_start_date TIMESTAMP WITH TIME ZONE := '2026-09-29 00:00:00+00'::timestamptz;
    v_payout_date DATE := v_now::date;
    v_payout_id TEXT := 'rank_payout_' || to_char(v_payout_date, 'YYYY_MM_DD');
    v_already_processed BOOLEAN;
    v_pool NUMERIC(12, 2) := 40.00;
    v_shares NUMERIC[] := ARRAY[0.375, 0.250, 0.175, 0.125, 0.075];
    v_rank INTEGER := 1;
    v_record RECORD;
    v_reward NUMERIC(12, 2);
    v_winners JSONB := '[]'::jsonb;
    v_winner_obj JSONB;
BEGIN
    -- 1. Validar fecha de inicio oficial (29/09/2026 a las 00:00 UTC)
    IF v_now < v_start_date THEN
        RETURN jsonb_build_object(
            'status', 'pending_start_date',
            'message', 'El reparto oficial inicia el 29/09/2026 a las 00:00 UTC.',
            'start_date_utc', v_start_date,
            'current_time_utc', v_now
        );
    END IF;

    -- 2. Validar si ya se liquidó hoy para evitar doble pago
    SELECT EXISTS (SELECT 1 FROM public.ranking_payouts WHERE payout_date = v_payout_date) INTO v_already_processed;
    IF v_already_processed THEN
        RETURN jsonb_build_object(
            'status', 'already_paid_today',
            'message', 'El reparto de hoy a las 00:00 UTC ya ha sido procesado.',
            'payout_date', v_payout_date
        );
    END IF;

    -- 3. Auditar los 5 reinos con mayor Poder Militar (⭐) real
    FOR v_record IN (
        SELECT id, username, power, king_claimed
        FROM public.kingdoms
        ORDER BY power DESC, created_at ASC
        LIMIT 5
    ) LOOP
        v_reward := ROUND(v_pool * v_shares[v_rank], 2);

        -- Acreditar saldo KING directamente en la cuenta del ganador
        UPDATE public.kingdoms
        SET king_claimed = king_claimed + v_reward,
            updated_at = v_now
        WHERE id = v_record.id;

        -- Generar reporte oficial de economía en su buzón
        INSERT INTO public.reports (
            id, player_id, type, target_name, result, is_victory, data, created_at
        ) VALUES (
            'rep_rank_' || v_record.id || '_' || to_char(v_payout_date, 'YYYYMMDD'),
            v_record.id,
            'ranking',
            'Premio Ranking Diario Top #' || v_rank,
            '¡Has obtenido +' || v_reward || ' KING por tu posición #' || v_rank || ' en el Top 5 continental!',
            true,
            jsonb_build_object(
                'type', 'ranking',
                'rank', v_rank,
                'rewardKing', v_reward,
                'power', v_record.power,
                'sharePercent', (v_shares[v_rank] * 100),
                'payoutDate', v_payout_date,
                'payoutTimeUtc', v_now,
                'timestamp', extract(epoch from v_now) * 1000
            ),
            v_now
        );

        -- Registrar en historial de ganadores
        v_winner_obj := jsonb_build_object(
            'rank', v_rank,
            'playerId', v_record.id,
            'username', v_record.username,
            'power', v_record.power,
            'sharePercent', (v_shares[v_rank] * 100),
            'rewardKing', v_reward
        );
        v_winners := v_winners || v_winner_obj;

        v_rank := v_rank + 1;
    END LOOP;

    -- 4. Registrar la liquidación oficial en la tabla ranking_payouts
    INSERT INTO public.ranking_payouts (
        id, payout_date, payout_time_utc, total_pool, winners, created_at
    ) VALUES (
        v_payout_id, v_payout_date, v_now, v_pool, v_winners, v_now
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'payout_date', v_payout_date,
        'winners', v_winners
    );
END;
$$;
