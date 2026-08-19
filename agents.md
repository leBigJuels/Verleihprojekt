# Projekt: Verleihliste

## Ziel

Einfache kostenlose Web-App für Freunde und Bekannte, über die Gegenstände
angesehen und zur Ausleihe angefragt werden können.

Das Projekt soll bewusst einfach bleiben.

## Technologie

- HTML
- CSS
- Vanilla JavaScript
- Supabase als Datenbank und Storage
- später GitHub Pages für Hosting

Keine Frameworks wie React oder Next.js verwenden, solange sie nicht
ausdrücklich benötigt werden.

## Aktueller Aufbau

- index.html
  - Kopfbereich
  - Tabelle mit 7 Spalten:
    1. Kategorie
    2. Name
    3. Bild
    4. Bezeichnung
    5. Verleihstatus
    6. Ausleihbutton
    7. Anmerkung
  - Modal für Ausleihanfrage

- style.css
  - Layout der Tabelle
  - Statusdarstellung
  - Buttons
  - Modal
  - grundlegendes Responsive Design

- script.js
  - Verbindung zu Supabase
  - liest Gegenstände aus der Tabelle `items`
  - erzeugt die HTML-Tabellenzeilen dynamisch
  - öffnet beim Klick auf "Ausleihen" ein Modal
  - Pflichtfeld im Modal: Name
  - optionales Feld: Anmerkung
  - Anfrage wird derzeit noch NICHT in Supabase gespeichert

## Supabase

Tabelle `items` enthält ungefähr:

- id
- category
- name
- image_url
- designation
- status
- note
- created_at

Mögliche Statuswerte:

- available
- loaned

Optionale Werte dürfen NULL sein.

Tabelle `requests` enthält ungefähr:

- id
- item_id
- borrower_name
- note
- status
- created_at

Neue Anfragen sollen später mit:

status = "pending"

gespeichert werden.

## Sicherheitsregeln

Der Supabase Publishable Key darf im Frontend verwendet werden.

Niemals:
- Supabase Secret Key
- service_role Key
- andere Secrets

in öffentliches JavaScript oder GitHub committen.

Row Level Security soll verwendet werden.

Öffentliche Besucher sollen:
- items lesen dürfen
- requests erstellen dürfen

Sie sollen NICHT:
- items ändern
- items löschen
- requests anderer Nutzer lesen
- requests ändern

## Vorgehensweise

Das Projekt schrittweise weiterentwickeln.

Keine unnötigen Frameworks oder Abhängigkeiten hinzufügen.

Vor größeren Änderungen zuerst kurz erklären:
1. was geändert werden soll
2. warum
3. welche Dateien betroffen sind

Bestehenden funktionierenden Code möglichst erhalten.

Ich möchte den Code als Anfänger nachvollziehen können. Änderungen daher
verständlich und nicht unnötig abstrakt halten.