-- =====================================================
-- IronPulse - Premium Social Workout Tracker
-- Database Schema for Supabase (PostgreSQL)
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
-- Stores user profile information linked to auth.users
-- =====================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    streak_count INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_workouts INTEGER DEFAULT 0,
    consistency_score DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- WORKOUTS TABLE
-- Stores workout sessions
-- =====================================================
CREATE TABLE public.workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
    notes TEXT,
    duration_minutes INTEGER,
    calories_burned INTEGER,
    workout_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- WORKOUT_LOGS TABLE
-- Stores individual exercise sets within a workout
-- =====================================================
CREATE TABLE public.workout_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    set_number INTEGER NOT NULL DEFAULT 1,
    reps INTEGER,
    weight DECIMAL(6,2),
    weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs')),
    duration_seconds INTEGER,
    distance_meters DECIMAL(10,2),
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- GROUPS TABLE
-- Social groups for workout challenges
-- =====================================================
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    max_members INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- GROUP_MEMBERS TABLE
-- Junction table for group membership
-- =====================================================
CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- =====================================================
-- ACTIVITY_LOG TABLE
-- Tracks daily activity for heatmap visualization
-- =====================================================
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    workout_count INTEGER DEFAULT 0,
    total_sets INTEGER DEFAULT 0,
    total_reps INTEGER DEFAULT 0,
    total_weight DECIMAL(10,2) DEFAULT 0,
    intensity_level INTEGER DEFAULT 1 CHECK (intensity_level BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

-- =====================================================
-- INDEXES for better query performance
-- =====================================================
CREATE INDEX idx_workouts_user_id ON public.workouts(user_id);
CREATE INDEX idx_workouts_workout_date ON public.workouts(workout_date);
CREATE INDEX idx_workouts_status ON public.workouts(status);
CREATE INDEX idx_workout_logs_workout_id ON public.workout_logs(workout_id);
CREATE INDEX idx_workout_logs_user_id ON public.workout_logs(user_id);
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_date ON public.activity_log(activity_date);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_groups_invite_code ON public.groups(invite_code);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
-- Users can view all profiles (for leaderboards)
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id);

-- WORKOUTS policies
-- Users can view their own workouts
CREATE POLICY "Users can view own workouts"
    ON public.workouts FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Users can create their own workouts
CREATE POLICY "Users can create own workouts"
    ON public.workouts FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can update their own workouts
CREATE POLICY "Users can update own workouts"
    ON public.workouts FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own workouts
CREATE POLICY "Users can delete own workouts"
    ON public.workouts FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- WORKOUT_LOGS policies
-- Users can view their own workout logs
CREATE POLICY "Users can view own workout logs"
    ON public.workout_logs FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Users can create their own workout logs
CREATE POLICY "Users can create own workout logs"
    ON public.workout_logs FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can update their own workout logs
CREATE POLICY "Users can update own workout logs"
    ON public.workout_logs FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own workout logs
CREATE POLICY "Users can delete own workout logs"
    ON public.workout_logs FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- GROUPS policies
-- Anyone can view public groups
CREATE POLICY "Public groups are viewable by everyone"
    ON public.groups FOR SELECT
    TO authenticated
    USING (is_public = true OR owner_id = (SELECT auth.uid()) OR 
           EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = (SELECT auth.uid())));

-- Users can create groups
CREATE POLICY "Users can create groups"
    ON public.groups FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = owner_id);

-- Only owners can update groups
CREATE POLICY "Owners can update groups"
    ON public.groups FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = owner_id)
    WITH CHECK ((SELECT auth.uid()) = owner_id);

-- Only owners can delete groups
CREATE POLICY "Owners can delete groups"
    ON public.groups FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = owner_id);

-- GROUP_MEMBERS policies
-- Members can view group membership
CREATE POLICY "Group members can view membership"
    ON public.group_members FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = (SELECT auth.uid())));

-- Users can join groups (insert themselves)
CREATE POLICY "Users can join groups"
    ON public.group_members FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can leave groups (delete themselves) or owners can remove members
CREATE POLICY "Users can leave groups or owners can remove"
    ON public.group_members FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id OR 
           EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND owner_id = (SELECT auth.uid())));

-- ACTIVITY_LOG policies
-- Users can view their own activity
CREATE POLICY "Users can view own activity"
    ON public.activity_log FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Users can create their own activity
CREATE POLICY "Users can create own activity"
    ON public.activity_log FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can update their own activity
CREATE POLICY "Users can update own activity"
    ON public.activity_log FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update profile timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_activity_log_updated_at
    BEFORE UPDATE ON public.activity_log
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to update activity log when workout is completed
CREATE OR REPLACE FUNCTION public.update_activity_on_workout()
RETURNS TRIGGER AS $$
DECLARE
    v_total_sets INTEGER;
    v_total_reps INTEGER;
    v_total_weight DECIMAL;
    v_intensity INTEGER;
BEGIN
    -- Only process when workout is marked as completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Calculate totals from workout logs
        SELECT 
            COALESCE(COUNT(*), 0),
            COALESCE(SUM(reps), 0),
            COALESCE(SUM(weight * reps), 0)
        INTO v_total_sets, v_total_reps, v_total_weight
        FROM public.workout_logs
        WHERE workout_id = NEW.id AND completed = true;
        
        -- Calculate intensity (1-5 based on volume)
        v_intensity := LEAST(5, GREATEST(1, CEIL(v_total_sets::DECIMAL / 10)));
        
        -- Upsert activity log
        INSERT INTO public.activity_log (user_id, activity_date, workout_count, total_sets, total_reps, total_weight, intensity_level)
        VALUES (NEW.user_id, NEW.workout_date, 1, v_total_sets, v_total_reps, v_total_weight, v_intensity)
        ON CONFLICT (user_id, activity_date) DO UPDATE SET
            workout_count = public.activity_log.workout_count + 1,
            total_sets = public.activity_log.total_sets + EXCLUDED.total_sets,
            total_reps = public.activity_log.total_reps + EXCLUDED.total_reps,
            total_weight = public.activity_log.total_weight + EXCLUDED.total_weight,
            intensity_level = LEAST(5, public.activity_log.intensity_level + 1),
            updated_at = NOW();
        
        -- Update profile stats
        UPDATE public.profiles
        SET 
            total_workouts = total_workouts + 1,
            updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for workout completion
CREATE TRIGGER on_workout_completed
    AFTER UPDATE ON public.workouts
    FOR EACH ROW EXECUTE FUNCTION public.update_activity_on_workout();

-- Function to calculate and update streak
CREATE OR REPLACE FUNCTION public.calculate_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_streak INTEGER := 0;
    v_current_date DATE := CURRENT_DATE;
    v_check_date DATE;
    v_has_activity BOOLEAN;
BEGIN
    -- Check consecutive days starting from today
    LOOP
        v_check_date := v_current_date - v_streak;
        
        SELECT EXISTS(
            SELECT 1 FROM public.activity_log 
            WHERE user_id = p_user_id AND activity_date = v_check_date
        ) INTO v_has_activity;
        
        IF v_has_activity THEN
            v_streak := v_streak + 1;
        ELSE
            EXIT;
        END IF;
        
        -- Safety limit
        IF v_streak > 365 THEN
            EXIT;
        END IF;
    END LOOP;
    
    -- Update profile with streak
    UPDATE public.profiles
    SET 
        streak_count = v_streak,
        longest_streak = GREATEST(longest_streak, v_streak),
        consistency_score = LEAST(100, (v_streak::DECIMAL / 30) * 100),
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8 character alphanumeric code
        v_code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check if exists
        SELECT EXISTS(SELECT 1 FROM public.groups WHERE invite_code = v_code) INTO v_exists;
        
        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA FOR TESTING (Optional - remove in production)
-- =====================================================
-- INSERT INTO public.groups (name, description, invite_code, owner_id, is_public)
-- VALUES ('IronPulse Champions', 'The elite workout group', 'IRON2024', <owner_uuid>, true);
