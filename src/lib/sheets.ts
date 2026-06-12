import { google, sheets_v4 } from "googleapis";

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (key) {
    key = key.trim();
    if (key.startsWith('"') && key.endsWith('"')) {
      key = key.slice(1, -1);
    } else if (key.startsWith("'") && key.endsWith("'")) {
      key = key.slice(1, -1);
    }
    key = key.replace(/\\n/g, "\n");
  }

  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEETS_ID");
  return id;
}

export interface Person {
  name: string;
  role: string;
}

/**
 * Lee la pestaña "Personas" del Google Sheet.
 * Espera columnas: Nombre | Rol
 */
export async function getPeople(): Promise<Person[]> {
  const sheets = getSheetClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Personas!A2:B",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  return rows
    .filter((row) => row[0])
    .map((row) => ({
      name: (row[0] as string).trim(),
      role: (row[1] as string || "nadador").trim().toLowerCase(),
    }));
}

/**
 * Asegura que existe una pestaña con el nombre de la persona.
 * Si no existe, la crea con los headers de columnas.
 */
async function ensurePersonSheet(personName: string): Promise<void> {
  const sheets = getSheetClient();
  const spreadsheetId = getSpreadsheetId();

  // Obtener lista de pestañas existentes
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames =
    spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

  if (sheetNames.includes(personName)) return;

  // Crear nueva pestaña
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: personName },
          },
        },
      ],
    },
  });

  // Añadir headers
  const headers = [
    "Fecha",
    "Series",
    "Estilos",
    "Tiempos",
    "Intensidad",
    "Material",
    "Pulso",
    "Notas",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${personName}!A1:H1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
}

export interface TrainingData {
  fecha: string;
  series: string;
  estilos: string;
  tiempos: string;
  intensidad: string;
  material: string;
  pulso: string;
  notas: string;
}

/**
 * Guarda un entrenamiento en la pestaña de la persona.
 */
export async function appendTraining(
  personName: string,
  data: TrainingData
): Promise<void> {
  await ensurePersonSheet(personName);

  const sheets = getSheetClient();
  const spreadsheetId = getSpreadsheetId();

  const row = [
    data.fecha,
    data.series,
    data.estilos,
    data.tiempos,
    data.intensidad,
    data.material,
    data.pulso,
    data.notas,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${personName}!A:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}
