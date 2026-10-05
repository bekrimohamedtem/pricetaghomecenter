import ExcelJS from "exceljs";
import { get, list, put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { BLOB_READ_WRITE_TOKEN } from "../cle.js";
import { celluleTexte, estColonnePromo, xmlSafe } from "./logic.js";

const NOM_CATALOGUE = "ClasseurARTICLES-03-10-descriptions.xlsx";
let pathnameBlob = NOM_CATALOGUE;
let accesBlob = "private";

function jetonBlob() {
  return String(BLOB_READ_WRITE_TOKEN || "").trim();
}

function optionsBlob(extra = {}) {
  const token = jetonBlob();
  return token ? { token, ...extra } : extra;
}

function utiliseBlob() {
  return Boolean(jetonBlob() || process.env.VERCEL);
}

export function excelPath() {
  if (process.env.EXCEL_FILE) return process.env.EXCEL_FILE;
  return path.join(process.cwd(), "ClasseurARTICLES-03-10-descriptions.xlsx");
}

export function logoPath() {
  return path.join(process.cwd(), "logo.png");
}

function valeurCellule(cell) {
  return celluleTexte(cell?.value);
}

function colonnes(sheet) {
  const row = sheet.getRow(1);
  const liste = [];
  const max = Math.max(row.cellCount, sheet.columnCount);
  for (let i = 1; i <= max; i += 1) {
    const nom = valeurCellule(row.getCell(i));
    if (nom) liste.push({ index: i, nom, bas: nom.toLowerCase() });
  }
  return liste;
}

function trouver(liste, test, defaut = null) {
  const trouve = liste.find((col) => test(col.bas));
  return trouve ? trouve.index : defaut;
}

function indexColonnes(sheet) {
  const liste = colonnes(sheet);
  return {
    liste,
    ref: trouver(liste, (nom) => nom.includes("ref") || nom.includes("réf") || nom.includes("code"), liste[0]?.index),
    des: trouver(
      liste,
      (nom) =>
        !nom.includes("description") &&
        nom !== "desc" &&
        (nom.includes("des") || nom.includes("dés") || nom.includes("nom") || nom.includes("lib"))
    ),
    prix: trouver(
      liste,
      (nom) => (nom.includes("prix") || nom.includes("price") || nom.includes("pvh")) && !nom.includes("promo")
    ),
    promo: trouver(liste, estColonnePromo),
    desc: trouver(liste, (nom) => nom.includes("description") || nom === "desc" || nom.includes("fiche")),
  };
}

function nombreOuTexte(texte) {
  const propre = celluleTexte(texte);
  if (!propre) return null;
  const number = Number(propre.replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(number) && !/[a-zA-Z]/.test(propre)) return number;
  return xmlSafe(propre);
}

async function trouverPathname() {
  const { blobs } = await list(optionsBlob());
  const fichier =
    blobs.find((blob) => blob.pathname === NOM_CATALOGUE) ||
    blobs.find((blob) => blob.pathname.toLowerCase().endsWith(".xlsx"));
  if (!fichier) {
    throw new Error(
      `Catalogue introuvable dans Blob. Dépose un fichier .xlsx (nom attendu : ${NOM_CATALOGUE}).`
    );
  }
  pathnameBlob = fichier.pathname;
  return fichier.pathname;
}

async function lireDepuisBlob(pathname, access) {
  try {
    return await get(pathname, optionsBlob({ access, useCache: false }));
  } catch {
    return null;
  }
}

async function lireOctetsCatalogue() {
  if (!utiliseBlob()) {
    const cible = excelPath();
    if (!fs.existsSync(cible)) {
      throw new Error("Écris le jeton dans web/cle.js : BLOB_READ_WRITE_TOKEN.");
    }
    return fs.readFileSync(cible);
  }
  const pathname = await trouverPathname();
  let resultat = await lireDepuisBlob(pathname, "private");
  accesBlob = "private";
  if (!resultat || resultat.statusCode !== 200) {
    resultat = await lireDepuisBlob(pathname, "public");
    accesBlob = "public";
  }
  if (!resultat || resultat.statusCode !== 200 || !resultat.stream) {
    throw new Error("Impossible de lire le catalogue dans Blob. Vérifie le jeton dans web/cle.js.");
  }
  return Buffer.from(await new Response(resultat.stream).arrayBuffer());
}

async function lireClasseur(source) {
  const workbook = new ExcelJS.Workbook();
  if (Buffer.isBuffer(source)) await workbook.xlsx.load(source);
  else await workbook.xlsx.readFile(source);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Le classeur ne contient aucune feuille.");
  return { workbook, sheet };
}

export async function lireArticles() {
  const { sheet } = await lireClasseur(await lireOctetsCatalogue());
  const cols = indexColonnes(sheet);
  if (!cols.ref) throw new Error("Colonne référence introuvable.");
  const articles = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const ref = valeurCellule(row.getCell(cols.ref));
    if (!ref) continue;
    articles.push({
      ref,
      designation: cols.des ? valeurCellule(row.getCell(cols.des)) : "",
      price: cols.prix ? valeurCellule(row.getCell(cols.prix)) : "",
      promo: cols.promo ? valeurCellule(row.getCell(cols.promo)) : "",
      description: cols.desc ? valeurCellule(row.getCell(cols.desc)) : "",
    });
  }
  return articles;
}

async function envoyerBlob(buffer) {
  const options = {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  try {
    await put(pathnameBlob, buffer, optionsBlob({ ...options, access: accesBlob }));
  } catch (error) {
    const autre = accesBlob === "private" ? "public" : "private";
    try {
      await put(pathnameBlob, buffer, optionsBlob({ ...options, access: autre }));
      accesBlob = autre;
    } catch {
      throw error;
    }
  }
}

async function ecrireClasseur(workbook) {
  if (utiliseBlob()) {
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await envoyerBlob(buffer);
    return;
  }
  const cible = excelPath();
  const temporaire = `${cible}.enregistrement.xlsx`;
  try {
    await workbook.xlsx.writeFile(temporaire);
    fs.renameSync(temporaire, cible);
  } catch (error) {
    if (fs.existsSync(temporaire)) {
      try {
        fs.unlinkSync(temporaire);
      } catch {
        /* le fichier temporaire peut rester verrouillé */
      }
    }
    if (error && (error.code === "EPERM" || error.code === "EBUSY" || error.code === "EACCES")) {
      const err = new Error(
        `Ferme le classeur « ${path.basename(cible)} » dans WPS ou Excel : il est ouvert, l'enregistrement est bloqué.`
      );
      err.status = 423;
      throw err;
    }
    throw error;
  }
}

export async function enregistrerDescription({ reference, description, designation = "", prix = "" }) {
  const ref = celluleTexte(reference);
  const texte = xmlSafe(description).trim();
  if (!ref || !texte) return { ok: true };
  const { workbook, sheet } = await lireClasseur(await lireOctetsCatalogue());
  let cols = indexColonnes(sheet);
  if (!cols.desc) {
    const index = sheet.columnCount + 1;
    sheet.getRow(1).getCell(index).value = "Description";
    cols = indexColonnes(sheet);
  }
  const cible = ref.toLowerCase();
  let trouve = false;
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    if (valeurCellule(row.getCell(cols.ref)).toLowerCase() !== cible) continue;
    if (valeurCellule(row.getCell(cols.desc)) === texte) return { ok: true };
    row.getCell(cols.desc).value = texte;
    trouve = true;
    break;
  }
  if (!trouve) {
    const row = sheet.getRow(sheet.rowCount + 1);
    row.getCell(cols.ref).value = ref;
    row.getCell(cols.desc).value = texte;
    if (cols.des && designation) row.getCell(cols.des).value = xmlSafe(designation);
    if (cols.prix && prix) row.getCell(cols.prix).value = nombreOuTexte(prix);
  }
  await ecrireClasseur(workbook);
  return { ok: true };
}

export async function integrerFichier(buffer) {
  const entrant = await lireClasseur(buffer);
  const inCols = indexColonnes(entrant.sheet);
  const colInRef =
    inCols.ref ||
    (entrant.sheet.getRow(1).cellCount ? 1 : null);
  const colInDes = inCols.des;
  const colInPrix = inCols.prix;
  const colInPromo = inCols.promo;
  if (!colInDes || !colInPrix) {
    const err = new Error("Le fichier doit contenir la référence, la désignation et le prix.");
    err.status = 400;
    throw err;
  }

  const { workbook, sheet } = await lireClasseur(await lireOctetsCatalogue());
  let cols = indexColonnes(sheet);
  if (colInPromo && !cols.promo) {
    const index = sheet.columnCount + 1;
    sheet.getRow(1).getCell(index).value = "prix_promo";
    cols = indexColonnes(sheet);
  }

  const index = new Map();
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const ref = valeurCellule(sheet.getRow(r).getCell(cols.ref)).toLowerCase();
    if (ref && !index.has(ref)) index.set(ref, r);
  }

  const nouveaux = [];
  const modifies = [];
  let identiques = 0;
  const vus = new Set();

  for (let r = 2; r <= entrant.sheet.rowCount; r += 1) {
    const row = entrant.sheet.getRow(r);
    const ref = valeurCellule(row.getCell(colInRef));
    const cle = ref.toLowerCase();
    if (!ref || vus.has(cle)) continue;
    vus.add(cle);
    const des = valeurCellule(row.getCell(colInDes));
    const prix = valeurCellule(row.getCell(colInPrix));
    const promo = colInPromo ? valeurCellule(row.getCell(colInPromo)) : "";

    if (!index.has(cle)) {
      const ligne = sheet.getRow(sheet.rowCount + 1);
      for (const col of cols.liste) ligne.getCell(col.index).value = null;
      ligne.getCell(cols.ref).value = ref;
      if (cols.des && des) ligne.getCell(cols.des).value = xmlSafe(des);
      if (cols.prix && prix) ligne.getCell(cols.prix).value = nombreOuTexte(prix);
      if (cols.promo) ligne.getCell(cols.promo).value = nombreOuTexte(promo);
      index.set(cle, ligne.number);
      nouveaux.push({ Référence: ref, Désignation: des, Prix: prix, "Prix promo": promo });
      continue;
    }

    const i = index.get(cle);
    const actuel = sheet.getRow(i);
    const changements = [];
    if (des && cols.des && valeurCellule(actuel.getCell(cols.des)) !== des) {
      const ancien = valeurCellule(actuel.getCell(cols.des));
      changements.push(`Désignation : ${ancien} → ${des}`);
      actuel.getCell(cols.des).value = xmlSafe(des);
    }
    if (prix && cols.prix && valeurCellule(actuel.getCell(cols.prix)) !== prix) {
      const ancien = valeurCellule(actuel.getCell(cols.prix));
      changements.push(`Prix : ${ancien} → ${prix}`);
      actuel.getCell(cols.prix).value = nombreOuTexte(prix);
    }
    if (colInPromo && cols.promo) {
      const promoActuel = valeurCellule(actuel.getCell(cols.promo));
      if (promo !== promoActuel) {
        changements.push(`Prix promo : ${promoActuel || "—"} → ${promo || "—"}`);
        actuel.getCell(cols.promo).value = nombreOuTexte(promo);
      }
    }
    if (changements.length) {
      modifies.push({ Référence: ref, Modifications: changements.join(" | ") });
    } else {
      identiques += 1;
    }
  }

  if (nouveaux.length || modifies.length) await ecrireClasseur(workbook);
  let absentes = 0;
  for (const ref of index.keys()) if (!vus.has(ref)) absentes += 1;
  return {
    nouveaux,
    modifies,
    identiques,
    absentes,
    refs: [...nouveaux, ...modifies].map((ligne) => ligne.Référence),
  };
}
