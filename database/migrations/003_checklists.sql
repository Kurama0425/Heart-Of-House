-- Reusable opening/closing checklist templates and tracked shift runs

CREATE TABLE checklist_templates (
    checklist_template_id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    checklist_type VARCHAR(10) NOT NULL CHECK (checklist_type IN ('opening', 'closing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, name)
);

CREATE TABLE checklist_template_tasks (
    checklist_template_task_id BIGSERIAL PRIMARY KEY,
    checklist_template_id BIGINT NOT NULL REFERENCES checklist_templates(checklist_template_id) ON DELETE CASCADE,
    description VARCHAR(300) NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    UNIQUE (checklist_template_id, position)
);

CREATE TABLE checklist_runs (
    checklist_run_id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
    checklist_template_id BIGINT NOT NULL REFERENCES checklist_templates(checklist_template_id),
    run_date DATE NOT NULL,
    shift_label VARCHAR(80) NOT NULL,
    template_name VARCHAR(150) NOT NULL,
    checklist_type VARCHAR(10) NOT NULL CHECK (checklist_type IN ('opening', 'closing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, run_date, checklist_template_id, shift_label)
);

CREATE TABLE checklist_run_tasks (
    checklist_run_task_id BIGSERIAL PRIMARY KEY,
    checklist_run_id BIGINT NOT NULL REFERENCES checklist_runs(checklist_run_id) ON DELETE CASCADE,
    description VARCHAR(300) NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (checklist_run_id, position)
);

CREATE INDEX idx_checklist_templates_restaurant ON checklist_templates(restaurant_id, checklist_type);
CREATE INDEX idx_checklist_runs_restaurant_date ON checklist_runs(restaurant_id, run_date);
CREATE INDEX idx_checklist_run_tasks_run ON checklist_run_tasks(checklist_run_id, position);
