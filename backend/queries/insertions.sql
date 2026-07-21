INSERT INTO users (name, phone, email, password_hash) VALUES (
    'First Last',
    '+1234567891233',
    'name@example.com',
    '$2b$12$KIXQ7z8vN3f9wJmR5tYkOuL8x4PqEjabc123456789hashdeejemplo'
);


INSERT INTO contacts (user_id, name, phone, email, confirmed) VALUES
(   1,
    'Jane Doe',
    '+584241234567',
    'jane@example.com',
    TRUE),
(   1,
    'John Doe',
    '+584161234567',
    NULL,
    FALSE);


INSERT INTO alerts (user_id, latitude, longitude) VALUES (1, 10.4880600, -66.8791500);
