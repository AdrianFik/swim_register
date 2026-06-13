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

  const headers = [
    "Fecha",
    "Series",
    "Estilos",
    "Tiempos",
    "Intensidad",
    "Material",
    "Pulso",
    "Notas",
    "Piscina",
  ];

  if (sheetNames.includes(personName)) {
    // Verificar si falta la columna Piscina y migrar
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${personName}!A1:I1`,
    });
    const currentHeaders = response.data.values?.[0] || [];
    if (!currentHeaders.includes("Piscina")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${personName}!A1:I1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
    return;
  }

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

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${personName}!A1:I1`,
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
  piscina: string;
}

export interface PersonalBest {
  nombre: string;
  estilo: string;
  distancia: number;
  tiempo: string;
  fecha: string;
  piscina: string;
}

/**
 * Asegura que existe la pestaña central de "Marcas" para PBs.
 */
async function ensureMarcasSheet(): Promise<void> {
  const sheets = getSheetClient();
  const spreadsheetId = getSpreadsheetId();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames =
    spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

  const headers = ["Nombre", "Estilo", "Distancia", "Tiempo", "Fecha", "Piscina"];

  if (sheetNames.includes("Marcas")) {
    // Verificar si falta la columna Piscina y migrar
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Marcas!A1:F1",
    });
    const currentHeaders = response.data.values?.[0] || [];
    if (!currentHeaders.includes("Piscina")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Marcas!A1:F1",
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
    return;
  }

  // Crear la pestaña
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: "Marcas" },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Marcas!A1:F1",
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
}

/**
 * Obtiene todas las marcas personales (PBs).
 * Opcionalmente filtra por nadador.
 */
export async function getMarcas(personName?: string): Promise<PersonalBest[]> {
  await ensureMarcasSheet();

  const sheets = getSheetClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Marcas!A2:F",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const allPBs: PersonalBest[] = rows
    .filter((row) => row[0])
    .map((row) => ({
      nombre: (row[0] as string).trim(),
      estilo: (row[1] as string || "").trim().toLowerCase(),
      distancia: parseInt(row[2] as string || "0", 10),
      tiempo: (row[3] as string || "").trim(),
      fecha: (row[4] as string || "").trim(),
      piscina: (row[5] as string || "25m").trim().toLowerCase(),
    }));

  if (personName) {
    const lowerName = personName.toLowerCase();
    return allPBs.filter((pb) => pb.nombre.toLowerCase() === lowerName);
  }

  return allPBs;
}

/**
 * Agrega o actualiza una marca personal (PB) en la pestaña "Marcas".
 */
export async function addOrUpdateMarca(
  nombre: string,
  estilo: string,
  distancia: number,
  tiempo: string,
  fecha: string,
  piscina: string
): Promise<void> {
  await ensureMarcasSheet();

  const sheets = getSheetClient();
  const spreadsheetId = getSpreadsheetId();

  // Obtener todas las filas para buscar coincidencias
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Marcas!A2:F",
  });

  const rows = response.data.values || [];
  let foundIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNombre = (row[0] as string || "").trim().toLowerCase();
    const rowEstilo = (row[1] as string || "").trim().toLowerCase();
    const rowDistancia = parseInt(row[2] as string || "0", 10);
    const rowPiscina = (row[5] as string || "25m").trim().toLowerCase();

    if (
      rowNombre === nombre.trim().toLowerCase() &&
      rowEstilo === estilo.trim().toLowerCase() &&
      rowDistancia === distancia &&
      rowPiscina === piscina.trim().toLowerCase()
    ) {
      foundIndex = i;
      break;
    }
  }

  const rowValue = [
    nombre.trim(),
    estilo.trim().toLowerCase(),
    distancia.toString(),
    tiempo.trim(),
    fecha.trim(),
    piscina.trim().toLowerCase(),
  ];

  if (foundIndex !== -1) {
    const sheetRowNumber = foundIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Marcas!A${sheetRowNumber}:F${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValue] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Marcas!A:F",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowValue] },
    });
  }
}

/**
 * Lee el histórico de entrenamientos de un nadador.
 */
export async function getTrainings(personName: string): Promise<TrainingData[]> {
  await ensurePersonSheet(personName);

  const sheets = getSheetClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${personName}!A2:I`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  return rows
    .filter((row) => row[0])
    .map((row) => ({
      fecha: (row[0] as string || "").trim(),
      series: (row[1] as string || "").trim(),
      estilos: (row[2] as string || "").trim(),
      tiempos: (row[3] as string || "").trim(),
      intensidad: (row[4] as string || "").trim(),
      material: (row[5] as string || "").trim(),
      pulso: (row[6] as string || "").trim(),
      notas: (row[7] as string || "").trim(),
      piscina: (row[8] as string || "25m").trim().toLowerCase(),
    }));
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
    data.piscina,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${personName}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}
