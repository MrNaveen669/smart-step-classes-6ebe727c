
-- Role enum (headroom for future users/students)
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

-- Question type enum
CREATE TYPE public.question_type AS ENUM ('single_correct', 'multiple_correct', 'true_false', 'fill_blank', 'numerical', 'image_based');
CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE public.publish_status AS ENUM ('draft', 'published', 'hidden');
CREATE TYPE public.extraction_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Timestamp trigger fn
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ user_roles (roles NEVER on profiles) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ profiles (headroom for future student registration) ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ subjects ============
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  status publish_status NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published subjects" ON public.subjects FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "auth read published subjects" ON public.subjects FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ chapters ============
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status publish_status NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, slug)
);
CREATE INDEX chapters_subject_idx ON public.chapters(subject_id);
GRANT SELECT ON public.chapters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published chapters" ON public.chapters FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "auth read chapters" ON public.chapters FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage chapters" ON public.chapters FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER chapters_updated_at BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ question_banks ============
CREATE TABLE public.question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INT,
  extraction_status extraction_status NOT NULL DEFAULT 'pending',
  extraction_error TEXT,
  extraction_meta JSONB DEFAULT '{}'::jsonb,
  question_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX qb_subject_idx ON public.question_banks(subject_id);
CREATE INDEX qb_chapter_idx ON public.question_banks(chapter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_banks TO authenticated;
GRANT ALL ON public.question_banks TO service_role;
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage banks" ON public.question_banks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER question_banks_updated_at BEFORE UPDATE ON public.question_banks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ questions ============
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bank_id UUID REFERENCES public.question_banks(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  question_number INT,
  question_type question_type NOT NULL DEFAULT 'single_correct',
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer JSONB,
  explanation TEXT,
  difficulty difficulty_level DEFAULT 'medium',
  marks NUMERIC(6,2) NOT NULL DEFAULT 1,
  negative_marks NUMERIC(6,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_bank_idx ON public.questions(question_bank_id);
CREATE INDEX questions_subject_idx ON public.questions(subject_id);
CREATE INDEX questions_chapter_idx ON public.questions(chapter_id);
CREATE INDEX questions_difficulty_idx ON public.questions(difficulty);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage questions" ON public.questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ test_series ============
CREATE TABLE public.test_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  instructions TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  total_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
  passing_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
  negative_marking BOOLEAN NOT NULL DEFAULT false,
  negative_mark_value NUMERIC(6,2) NOT NULL DEFAULT 0,
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  shuffle_options BOOLEAN NOT NULL DEFAULT false,
  random_questions BOOLEAN NOT NULL DEFAULT false,
  difficulty_mix JSONB DEFAULT '{}'::jsonb,
  status publish_status NOT NULL DEFAULT 'draft',
  expiry_date TIMESTAMPTZ,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_free BOOLEAN NOT NULL DEFAULT true,
  attempt_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ts_subject_idx ON public.test_series(subject_id);
CREATE INDEX ts_status_idx ON public.test_series(status);
GRANT SELECT ON public.test_series TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_series TO authenticated;
GRANT ALL ON public.test_series TO service_role;
ALTER TABLE public.test_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published tests" ON public.test_series FOR SELECT TO anon USING (status = 'published' AND (expiry_date IS NULL OR expiry_date > now()));
CREATE POLICY "auth read tests" ON public.test_series FOR SELECT TO authenticated USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage tests" ON public.test_series FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER test_series_updated_at BEFORE UPDATE ON public.test_series FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ test_series_questions (M:N ordered) ============
CREATE TABLE public.test_series_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id UUID NOT NULL REFERENCES public.test_series(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  marks_override NUMERIC(6,2),
  negative_override NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(test_series_id, question_id)
);
CREATE INDEX tsq_test_idx ON public.test_series_questions(test_series_id);
GRANT SELECT ON public.test_series_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_series_questions TO authenticated;
GRANT ALL ON public.test_series_questions TO service_role;
ALTER TABLE public.test_series_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read test questions for published tests" ON public.test_series_questions FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.test_series t WHERE t.id = test_series_id AND t.status = 'published'));
CREATE POLICY "auth read test questions" ON public.test_series_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_series t WHERE t.id = test_series_id AND (t.status = 'published' OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "admins manage test questions" ON public.test_series_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ test_attempts (headroom for student V2; anonymous session-based for V1) ============
CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id UUID NOT NULL REFERENCES public.test_series(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  student_name TEXT,
  student_email TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  duration_seconds INT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_marks NUMERIC(8,2),
  obtained_marks NUMERIC(8,2),
  correct_count INT,
  wrong_count INT,
  skipped_count INT,
  percentage NUMERIC(5,2),
  accuracy NUMERIC(5,2),
  passed BOOLEAN,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ta_test_idx ON public.test_attempts(test_series_id);
CREATE INDEX ta_session_idx ON public.test_attempts(session_id);
GRANT SELECT, INSERT, UPDATE ON public.test_attempts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts TO authenticated;
GRANT ALL ON public.test_attempts TO service_role;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
-- V1: anonymous by session_id. Reads limited to the same session_id passed in, writes allow inserting.
CREATE POLICY "anyone can insert attempt" ON public.test_attempts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth insert attempt" ON public.test_attempts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "anyone read attempts (v1 by id)" ON public.test_attempts FOR SELECT TO anon USING (true);
CREATE POLICY "auth read attempts" ON public.test_attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "anyone update own attempt" ON public.test_attempts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth update attempts" ON public.test_attempts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
