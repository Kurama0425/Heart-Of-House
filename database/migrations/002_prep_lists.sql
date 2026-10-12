-- Daily prep lists and persistent task completion

CREATE TABLE prep_lists (
    prep_list_id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
    prep_date DATE NOT NULL,
    title VARCHAR(150) NOT NULL DEFAULT 'Daily Prep',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, prep_date)
);

CREATE TABLE prep_tasks (
    prep_task_id BIGSERIAL PRIMARY KEY,
    prep_list_id BIGINT NOT NULL REFERENCES prep_lists(prep_list_id) ON DELETE CASCADE,
    description VARCHAR(300) NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prep_list_id, position)
);

CREATE INDEX idx_prep_lists_restaurant_date ON prep_lists(restaurant_id, prep_date);
CREATE INDEX idx_prep_tasks_list_position ON prep_tasks(prep_list_id, position);
