DROP TABLE IF EXISTS location_table;

CREATE TABLE location_table (
    id SERIAL PRIMARY KEY,
    latitude FLOAT,
    longitude FLOAT,
    place_id VARCHAR(255)
)
