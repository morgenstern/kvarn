/** One entry per notable version. Version numbers are commit counts (see
 * vite.config.ts), so they may skip internal/technical commits — that's
 * expected, not a gap to fill in. Add a new entry here in the same commit
 * as every user-facing feature or fix, using the version this commit will
 * become (current `git rev-list --count HEAD` + 1). */
export interface ReleaseNote {
  version: number;
  de: string;
  en: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  { version: 1, de: "Erste Version: Setup anlegen und einen Espresso brühen.", en: "First version: create a setup and brew an espresso." },
  { version: 5, de: "Wetter wird jetzt automatisch einbezogen, mit ersten Kompass-Empfehlungen für den Mahlgrad.", en: "Weather is now factored in automatically, with first Compass grind suggestions." },
  { version: 7, de: "Geräte-Katalog, Community-Vorschläge, Bohnenfotos und Auswertungen hinzugefügt.", en: "Added an equipment catalog, community suggestions, bean photos, and insights." },
  { version: 8, de: "Mehrsprachigkeit, Onboarding, Benutzerkonten, Datenexport und ein Feedback-Formular.", en: "Multi-language support, onboarding, accounts, data export, and a feedback form." },
  { version: 9, de: "Neue Icons, größere Schrift, verpflichtendes Onboarding und Produkt-Illustrationen.", en: "New icons, larger type, mandatory onboarding, and product illustrations." },
  { version: 10, de: "Community-Geräte bekommen jetzt automatisch generierte Illustrationen.", en: "Community gear now gets automatically generated illustrations." },
  { version: 11, de: "Neue Produktkarten und eine visuelle Auswahl beim Brühen.", en: "New product cards and a visual picker when brewing." },
  { version: 12, de: "Espressomaschinen können jetzt als eigenes Zubehör angelegt und in Setups genutzt werden.", en: "Espresso machines can now be added as their own gear and used in setups." },
  { version: 13, de: "Neues Markendesign, Live-Ratio-Anzeige beim Brühen, überarbeitete Startseite.", en: "New brand look, a live ratio display while brewing, and a redesigned home screen." },
  { version: 17, de: "Bedienung auf dem Smartphone verbessert (größere Tippflächen).", en: "Improved mobile usability with larger tap targets." },
  { version: 18, de: "Über 40 deutsche Röstereien und Marken im Bohnen-Katalog ergänzt.", en: "Added 40+ German roasters and brands to the bean catalog." },
  { version: 19, de: "Mahlgrad, Dosis und Ausbeute jetzt per Ziehen oder Eintippen einstellbar.", en: "Grind, dose, and yield can now be adjusted by dragging or typing." },
  { version: 21, de: "Hinweis zum Hinzufügen von Kvarn zum Home-Bildschirm im Onboarding.", en: "Added a home-screen install hint to onboarding." },
  { version: 22, de: "Optionaler Schritt zur Kontoerstellung im Onboarding.", en: "Added an optional account-creation step to onboarding." },
  { version: 25, de: "Einheitlicheres Layout für Karten und Listen in der ganzen App.", en: "More consistent layout for cards and lists across the app." },
  { version: 27, de: "Neues Onboarding mit Willkommensbildschirm, Fortschrittsanzeige und Mehrfachauswahl.", en: "Redesigned onboarding with a welcome screen, progress dots, and multi-add." },
  { version: 28, de: "Mühlen- und Maschinensuche in Setup jetzt ein-/ausklappbar.", en: "Grinder/machine search in Setup can now be collapsed." },
  { version: 29, de: "Individueller Mahlgrad-Bereich (Min/Max/Schritt) je Mühle einstellbar.", en: "Configurable grind range (min/max/step) per grinder." },
  { version: 30, de: "Mahlgrad-Bereich wird jetzt über ein Popup bearbeitet, auch direkt beim Onboarding.", en: "Grind range is now edited via a popup, including during onboarding." },
  { version: 31, de: "Im Onboarding kann man jetzt auch einen Schritt zurückgehen.", en: "You can now go back a step during onboarding." },
  { version: 32, de: "Vorinfusion beim Brühen kann jetzt aktiviert werden.", en: "Pre-infusion can now be enabled when brewing." },
  { version: 33, de: "Mühlen und Maschinen lassen sich umbenennen und löschen.", en: "Grinders and machines can now be renamed and deleted." },
  { version: 34, de: "Versionsnummer und Versionshinweise in den Einstellungen ergänzt.", en: "Added a version number and release notes to Settings." },
  { version: 56, de: "Mühlen mit zwei Rädern (Haupt- und Unterklicks, z. B. Kingrinder K6) werden jetzt unterstützt.", en: "Grinders with two dials (main + subclicks, e.g. Kingrinder K6) are now supported." },
  { version: 58, de: "Bei angemeldetem Konto zeigt der Header jetzt deinen Namen statt „Einstellungen“.", en: "When signed in, the header now shows your name instead of \"Settings\"." },
  { version: 65, de: "Vergangene Bezüge lassen sich jetzt nachtragen, ganz ohne Timer.", en: "You can now log a past brew without using the timer." },
];
