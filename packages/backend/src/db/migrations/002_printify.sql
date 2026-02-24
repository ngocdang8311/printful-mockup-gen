-- Add provider column to presets
ALTER TABLE presets ADD COLUMN provider TEXT NOT NULL DEFAULT 'printful';

-- Add provider column to jobs
ALTER TABLE jobs ADD COLUMN provider TEXT NOT NULL DEFAULT 'printful';
