import PDFDocument from "pdfkit";
import fs from "fs";
import { dialog } from "electron";
import log from "electron-log";
import { loadConfig } from "./fileManager";
import paths from "./utils/paths";

/**
 * Convertit une valeur en nombre (0 si invalide)
 */
function num(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

/**
 * Formate un numéro de téléphone français : 06 12 34 56 78
 */
function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return phone;
}

/**
 * Formate un SIRET : 123 456 789 00012
 */
function formatSiret(siret) {
  if (!siret) return "";
  const digits = siret.replace(/\D/g, "");
  if (digits.length === 14) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return siret;
}

/**
 * Formate un IBAN : FR76 1234 5678 9012 3456 7890 123
 */
function formatIban(iban) {
  if (!iban) return "";
  const clean = iban.replace(/\s/g, "");
  return clean.replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * Génère un PDF pour un devis ou une facture
 * @param {string} type - 'devis' ou 'factures'
 * @param {Object} document - Document à exporter
 * @returns {Promise<string>} Chemin du fichier PDF créé
 */
export async function generatePDF(type, document) {
  try {
    // Charger la configuration
    const config = await loadConfig();
    const company = config?.company || {};
    const billing = config?.billing || {};
    const rib = config?.rib || {};

    // Dialogue pour choisir l'emplacement de sauvegarde
    const filename = `QBMaker ${type === "devis" ? "Devis" : "Facture"} ${document.numero || "document"}.pdf`;
    const defaultPath = billing.pdfOutputPath
      ? `${billing.pdfOutputPath}/${filename}`
      : filename;

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: `Enregistrer le ${type === "devis" ? "devis" : "la facture"}`,
      defaultPath,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (canceled || !filePath) {
      return null;
    }

    // Créer le document PDF
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 30, left: 50, right: 50 },
      info: {
        Title: `${type === "devis" ? "Devis" : "Facture"} ${document.numero || ""}`,
        Author: company.companyName || "",
      },
    });

    // Stream vers le fichier
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Rendre le contenu
    renderHeader(doc, company, type, document, document.customer || {});
    renderObjet(doc, document.object);
    renderServices(doc, document.services || []);
    renderTotals(doc, document.totals || {}, billing, type);
    renderFooter(doc, company, billing, rib, type);

    // Finaliser le PDF
    doc.end();

    // Attendre que le stream soit terminé
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    log.info(`PDF generated successfully: ${filePath}`);
    return filePath;
  } catch (error) {
    log.error("Failed to generate PDF:", error);
    throw new Error(`Erreur lors de la génération du PDF : ${error.message}`);
  }
}

/**
 * Rendre l'en-tête du document (2 colonnes)
 * Gauche : logo + infos entreprise
 * Droite : type de document, numéro, dates, infos client
 */
function renderHeader(doc, company, type, document, customer) {
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const colWidth = (pageWidth - 2 * margin) / 2;
  const rightX = margin + colWidth + 20;
  const topY = 50;

  // ========== COLONNE GAUCHE : Logo + Entreprise ==========
  let leftY = topY;

  // Logo
  try {
    if (fs.existsSync(paths.LOGO_PATH)) {
      const logoBuffer = fs.readFileSync(paths.LOGO_PATH);
      doc.image(logoBuffer, margin, leftY, { fit: [70, 70] });
      leftY += 80;
    }
  } catch (err) {
    log.warn("Could not load logo for PDF:", err.message);
  }

  // Nom entreprise
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#1e293b")
    .text(company.companyName || "", margin, leftY, { width: colWidth });
  leftY += 16;

  // Adresse
  doc.fontSize(11).font("Helvetica");
  if (company.address) {
    doc.text(company.address, margin, leftY, { width: colWidth });
    leftY += 13;
  }
  if (company.postalCode || company.city) {
    doc.text(
      `${company.postalCode || ""} ${company.city || ""}`,
      margin,
      leftY,
      { width: colWidth },
    );
    leftY += 13;
  }

  // Contact
  if (company.email) {
    doc.text(company.email, margin, leftY, { width: colWidth });
    leftY += 13;
  }
  if (company.phoneNumber) {
    doc.text(formatPhone(company.phoneNumber), margin, leftY, {
      width: colWidth,
    });
    leftY += 13;
  }

  // ========== COLONNE DROITE : Document + Client ==========
  let rightY = topY;
  const rightColWidth = colWidth - 20;

  // Titre DEVIS / FACTURE
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .fillColor("#244b63")
    .text(type === "devis" ? "DEVIS" : "FACTURE", rightX, rightY, {
      width: rightColWidth,
    });
  rightY += 30;

  // Numéro
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`N° ${document.numero || ""}`, rightX, rightY, {
      width: rightColWidth,
    });
  rightY += 20;

  // Date
  doc.fontSize(10).font("Helvetica");
  doc.text(`Date : ${document.date || ""}`, rightX, rightY, {
    width: rightColWidth,
  });
  rightY += 14;

  // Date de validité / échéance
  if (type === "devis") {
    doc.text(
      `Valable jusqu'au : ${document.validityDate || ""}`,
      rightX,
      rightY,
      { width: rightColWidth },
    );
  } else {
    doc.text(`Échéance : ${document.dueDate || ""}`, rightX, rightY, {
      width: rightColWidth,
    });
  }
  rightY += 25;

  doc.fontSize(11).font("Helvetica-Bold").fillColor("#1e293b");
  if (customer.customerName) {
    doc.text(customer.customerName, rightX, rightY, { width: rightColWidth });
    rightY += 14;
  }
  if (customer.companyName && customer.companyName !== customer.customerName) {
    doc.text(customer.companyName, rightX, rightY, { width: rightColWidth });
    rightY += 14;
  }

  doc.font("Helvetica");
  if (customer.companyId) {
    doc.text(`SIRET : ${formatSiret(customer.companyId)}`, rightX, rightY, {
      width: rightColWidth,
    });
    rightY += 13;
  }
  if (customer.address) {
    doc.text(customer.address, rightX, rightY, { width: rightColWidth });
    rightY += 13;
  }
  if (customer.postalCode || customer.city) {
    doc.text(
      `${customer.postalCode || ""} ${customer.city || ""}`,
      rightX,
      rightY,
      { width: rightColWidth },
    );
    rightY += 13;
  }
  if (customer.email) {
    doc.text(customer.email, rightX, rightY, { width: rightColWidth });
    rightY += 13;
  }
  if (customer.phoneNumber) {
    doc.text(`Tél : ${formatPhone(customer.phoneNumber)}`, rightX, rightY, {
      width: rightColWidth,
    });
    rightY += 13;
  }

  doc.y = Math.max(leftY, rightY) + 10;
  doc.moveDown(1);
}

/**
 * Rendre l'objet du document
 */
function renderObjet(doc, object) {
  if (!object) return;

  const margin = doc.page.margins.left;

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Prestation de service :", margin, doc.y);

  doc
    .fontSize(11)
    .font("Helvetica")
    .text(object, margin, doc.y, {
      width: doc.page.width - 2 * margin,
    });

  doc.moveDown(1);
}

/**
 * Rendre le tableau des prestations
 */
function renderServices(doc, services) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width;
  const tableTop = doc.y;
  const tableWidth = pageWidth - 2 * margin;

  // Colonnes du tableau
  const col1Width = tableWidth * 0.4; // Description
  const col2Width = tableWidth * 0.12; // Quantité
  const col3Width = tableWidth * 0.15; // Unité
  const col4Width = tableWidth * 0.18; // P.U. HT
  const col5Width = tableWidth * 0.15; // Total HT

  // En-têtes du tableau
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#1e293b");

  let y = tableTop;

  // Positions X des séparateurs verticaux (entre chaque colonne)
  const colSeparators = [
    margin + col1Width,
    margin + col1Width + col2Width,
    margin + col1Width + col2Width + col3Width,
    margin + col1Width + col2Width + col3Width + col4Width,
  ];

  function drawVerticalSeparators(rowY, rowHeight) {
    doc.strokeColor("#6f8ca3");
    for (const x of colSeparators) {
      doc
        .moveTo(x, rowY)
        .lineTo(x, rowY + rowHeight)
        .stroke();
    }
  }

  const headerHeight = 25;
  const minRowHeight = 25;
  const cellPadding = 6;
  const tableRadius = 6;

  // Pré-calculer la hauteur de chaque ligne selon le contenu
  doc.fontSize(10).font("Helvetica");
  const rowHeights = services.map((service) => {
    const textHeight = doc.heightOfString(service.description || "", {
      width: col1Width - 10,
    });
    return Math.max(minRowHeight, textHeight + 2 * cellPadding);
  });

  const totalRowsHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  const tableHeight = Math.max(100, headerHeight + totalRowsHeight);

  // Clip arrondi sur tout le tableau
  doc.save();
  doc.roundedRect(margin, y, tableWidth, tableHeight, tableRadius).clip();

  // En-tête
  doc.font("Helvetica-Bold");
  doc.rect(margin, y, tableWidth, headerHeight).fill("#244b63");

  doc
    .fillColor("#ffffff")
    .text("Description", margin + 5, y + 8, { width: col1Width - 10 })
    .text("Quantité", margin + col1Width + 5, y + 8, {
      width: col2Width - 10,
      align: "right",
    })
    .text("Unité", margin + col1Width + col2Width + 5, y + 8, {
      width: col3Width - 10,
      align: "right",
    })
    .text(
      "Prix Unitaire HT",
      margin + col1Width + col2Width + col3Width + 5,
      y + 8,
      { width: col4Width - 10, align: "right" },
    )
    .text(
      "Total HT",
      margin + col1Width + col2Width + col3Width + col4Width + 5,
      y + 8,
      { width: col5Width - 10, align: "right" },
    );

  y += headerHeight;

  // Lignes du tableau
  doc.font("Helvetica");
  services.forEach((service, index) => {
    const rowHeight = rowHeights[index];

    // Alterner les couleurs de fond
    const bgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
    doc.rect(margin, y, tableWidth, rowHeight).fill(bgColor);

    doc
      .fillColor("#1e293b")
      .text(service.description || "", margin + 5, y + cellPadding, {
        width: col1Width - 10,
      })
      .text(String(num(service.quantity)), margin + col1Width + 5, y + cellPadding, {
        width: col2Width - 10,
        align: "right",
      })
      .text(service.unit || "", margin + col1Width + col2Width + 5, y + cellPadding, {
        width: col3Width - 10,
        align: "right",
      })
      .text(
        `${num(service.unitPriceHT).toFixed(2)} €`,
        margin + col1Width + col2Width + col3Width + 5,
        y + cellPadding,
        { width: col4Width - 10, align: "right" },
      )
      .text(
        `${num(service.totalHT).toFixed(2)} €`,
        margin + col1Width + col2Width + col3Width + col4Width + 5,
        y + cellPadding,
        { width: col5Width - 10, align: "right" },
      );

    y += rowHeight;
  });

  // Séparateurs verticaux sur toute la hauteur du tableau (sous le header)
  drawVerticalSeparators(tableTop + headerHeight, tableHeight - headerHeight);

  // Restaurer le contexte et dessiner le contour arrondi
  doc.restore();
  doc
    .roundedRect(margin, tableTop, tableWidth, tableHeight, tableRadius)
    .strokeColor("#6f8ca3")
    .stroke();

  doc.y = tableTop + tableHeight + 10;
}

/**
 * Rendre les totaux
 */
function renderTotals(doc, totals, billing, type) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width;

  const boxPadding = 10;
  const contentWidth = 200;
  const boxWidth = contentWidth + 2 * boxPadding;
  const boxX = pageWidth - margin - boxWidth;
  const boxHeight = 55 + 2 * boxPadding;
  const boxRadius = 6;
  const boxY = doc.y + 10;
  const contentX = boxX + boxPadding;
  const contentY = boxY + boxPadding;

  // Moyens de règlement à gauche (pour devis)
  if (type === "devis" && billing.meansOfPayment) {
    const leftWidth = boxX - margin - 20;
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("Moyens de règlement :", margin, contentY, { width: leftWidth });
    doc.font("Helvetica").text(billing.meansOfPayment, margin, contentY + 12, {
      width: leftWidth,
    });
  }

  // Contour arrondi de l'encart
  doc
    .roundedRect(boxX, boxY, boxWidth, boxHeight, boxRadius)
    .strokeColor("#6f8ca3")
    .stroke();

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor("#1e293b")
    .text("Total HT:", contentX, contentY, { width: 120, align: "left" })
    .text(`${num(totals.totalHT).toFixed(2)} €`, contentX + 120, contentY, {
      width: 80,
      align: "right",
    });

  doc
    .text("TVA (0%):", contentX, contentY + 20, { width: 120, align: "left" })
    .text(`${num(totals.VAT).toFixed(2)} €`, contentX + 120, contentY + 20, {
      width: 80,
      align: "right",
    });

  // Total TTC en gras
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Total TTC:", contentX, contentY + 45, { width: 120, align: "left" })
    .text(
      `${num(totals.totalTTC).toFixed(2)} €`,
      contentX + 120,
      contentY + 45,
      {
        width: 80,
        align: "right",
      },
    );

  // Mention TVA
  doc
    .fontSize(9)
    .font("Helvetica-Oblique")
    .fillColor("#64748b")
    .text(
      "TVA non applicable, art. 293 B du CGI",
      margin,
      boxY + boxHeight + 5,
      {
        align: "right",
        width: pageWidth - 2 * margin,
      },
    );

  doc.fillColor("#1e293b");
  doc.y = boxY + boxHeight + 20;
}

/**
 * Rendre le pied de page avec mentions légales et identité entreprise
 */
function renderFooter(doc, company, billing, rib, type) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - 2 * margin;

  // Hauteur réservée pour le bandeau identité en bas de page
  const identityHeight = 30;
  const identityY = pageHeight - margin - identityHeight;

  // Calculer la hauteur du contenu footer (mentions, RIB, etc.)
  let footerContentHeight = 5;
  if (type === "devis") footerContentHeight += 15;
  if (type === "factures" && billing.paymentTerms) footerContentHeight += 30;
  if (type === "factures" && billing.latePenalties) footerContentHeight += 30;
  if (billing.legalNotice) footerContentHeight += 25;
  if (rib.iban) footerContentHeight += 50;

  // Mention bon pour accord (pour devis)
  if (type === "devis") {
    doc.moveDown(2);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#1e293b")
      .text(
        "Devis à retourner signé avec la mention « BON POUR ACCORD » pour valider le devis et lancer la commande en production.",
        margin,
        doc.y,
        { width: 350 },
      );
    doc.y += 15;
  }

  // Si le contenu + footer ne tiennent pas, ajouter une page
  const footerStartY = identityY - footerContentHeight;
  if (doc.y > footerStartY - 10) {
    doc.addPage();
  }

  // Positionner le footer juste au-dessus du bandeau identité
  doc.y = footerStartY;

  // Conditions de paiement (pour factures)
  if (type === "factures" && billing.paymentTerms) {
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("Conditions de paiement :", margin, doc.y, { width: contentWidth });
    doc
      .font("Helvetica")
      .text(billing.paymentTerms, margin, doc.y + 12, { width: contentWidth });
    doc.y += 30;
  }

  // Pénalités de retard (pour factures)
  if (type === "factures" && billing.latePenalties) {
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#64748b")
      .text(billing.latePenalties, margin, doc.y, { width: contentWidth });
    doc.y += 30;
  }

  // Mention légale
  if (billing.legalNotice) {
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#64748b")
      .text(billing.legalNotice, margin, doc.y, { width: contentWidth });
    doc.y += 25;
  }

  // RIB si configuré
  if (type === "factures" && rib.iban) {
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("Coordonnées bancaires :", margin, doc.y, { width: contentWidth });
    doc.font("Helvetica").fontSize(9);
    let ribY = doc.y + 13;
    doc.text(`IBAN : ${formatIban(rib.iban)}`, margin, ribY, {
      width: contentWidth,
    });
    ribY += 12;
    if (rib.bic) {
      doc.text(`BIC : ${rib.bic}`, margin, ribY, { width: contentWidth });
      ribY += 12;
    }
  }

  // ========== Bandeau identité entreprise (bas de page) ==========
  const parts = [
    company.companyName,
    company.ownerName,
    `Siège social : ${company.registeredAddress}`,
    company.companyId ? `SIRET : ${formatSiret(company.companyId)}` : null,
    "Entrepreneur individuel",
    company.phoneNumber ? formatPhone(company.phoneNumber) : null,
    company.email,
    company.webSite,
  ].filter(Boolean);

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#64748b")
    .text(parts.join("  -  "), margin, identityY + 8, {
      width: contentWidth,
      align: "center",
      lineGap: 2,
    });
}
