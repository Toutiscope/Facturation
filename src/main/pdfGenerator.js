import PDFDocument from "pdfkit";
import fs from "fs";
import { dialog } from "electron";
import log from "electron-log";
import { loadConfig } from "./fileManager";

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

    // Dialogue pour choisir l'emplacement de sauvegarde
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: `Enregistrer le ${type === "devis" ? "devis" : "la facture"}`,
      defaultPath: `${document.numero}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (canceled || !filePath) {
      return null;
    }

    // Créer le document PDF
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `${type === "devis" ? "Devis" : "Facture"} ${document.numero}`,
        Author: config.company.companyName,
      },
    });

    // Stream vers le fichier
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Rendre le contenu
    renderHeader(doc, config, type, document);
    renderCustomer(doc, document.customer);
    renderServices(doc, document.services);
    renderTotals(doc, document.totals);
    renderFooter(doc, config, type, document);

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
    throw new Error("Erreur lors de la génération du PDF");
  }
}

/**
 * Rendre l'en-tête du document
 */
function renderHeader(doc, config, type, document) {
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;

  // Titre du document (DEVIS ou FACTURE)
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(type === "devis" ? "DEVIS" : "FACTURE", margin, 50, {
      align: "left",
    });

  // Informations entreprise (à droite)
  const rightX = pageWidth - 250;
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(config.company.companyName, rightX, 50)
    .font("Helvetica")
    .text(config.company.address, rightX, 65)
    .text(`${config.company.postalCode} ${config.company.city}`, rightX, 78)
    .text(`SIRET: ${config.company.companyId}`, rightX, 91)
    .text(config.company.email, rightX, 104);

  if (config.company.phoneNumber) {
    doc.text(config.company.phoneNumber, rightX, 117);
  }

  // Numéro et dates
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`N° ${document.numero}`, margin, 140)
    .font("Helvetica")
    .fontSize(10)
    .text(`Date: ${document.date}`, margin, 158);

  if (type === "devis") {
    doc.text(`Valable jusqu'au: ${document.validityDate}`, margin, 173);
  } else {
    doc.text(`Échéance: ${document.dueDate}`, margin, 173);
  }

  // Ligne de séparation
  doc
    .moveTo(margin, 200)
    .lineTo(pageWidth - margin, 200)
    .strokeColor("#e2e8f0")
    .stroke();

  doc.moveDown(2);
}

/**
 * Rendre les informations client
 */
function renderCustomer(doc, customer) {
  const margin = doc.page.margins.left;
  const startY = 220;

  doc.fontSize(12).font("Helvetica-Bold").text("CLIENT", margin, startY);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(customer.customerName, margin, startY + 20)
    .text(customer.companyName, margin, startY + 35);

  if (customer.companyId) {
    doc.text(`SIRET: ${customer.companyId}`, margin, startY + 50);
  }

  doc
    .text(customer.address, margin, startY + (customer.companyId ? 65 : 50))
    .text(
      `${customer.postalCode} ${customer.city}`,
      margin,
      startY + (customer.companyId ? 80 : 65),
    )
    .text(customer.email, margin, startY + (customer.companyId ? 95 : 80));

  doc.moveDown(3);
}

/**
 * Rendre le tableau des prestations
 */
function renderServices(doc, services) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width;
  const tableTop = doc.y + 20;
  const tableWidth = pageWidth - 2 * margin;

  // Colonnes du tableau
  const col1Width = tableWidth * 0.4; // Description
  const col2Width = tableWidth * 0.12; // Quantité
  const col3Width = tableWidth * 0.18; // Unité
  const col4Width = tableWidth * 0.15; // P.U. HT
  const col5Width = tableWidth * 0.15; // Total HT

  // En-têtes du tableau
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#1e293b");

  let y = tableTop;

  // Dessiner les en-têtes
  doc.rect(margin, y, tableWidth, 25).fillAndStroke("#f8fafc", "#e2e8f0");

  doc
    .fillColor("#1e293b")
    .text("Description", margin + 5, y + 8, { width: col1Width - 10 })
    .text("Quantité", margin + col1Width + 5, y + 8, { width: col2Width - 10 })
    .text("Unité", margin + col1Width + col2Width + 5, y + 8, {
      width: col3Width - 10,
    })
    .text("P.U. HT", margin + col1Width + col2Width + col3Width + 5, y + 8, {
      width: col4Width - 10,
    })
    .text(
      "Total HT",
      margin + col1Width + col2Width + col3Width + col4Width + 5,
      y + 8,
      { width: col5Width - 10 },
    );

  y += 25;

  // Lignes du tableau
  doc.font("Helvetica");
  services.forEach((service, index) => {
    const rowHeight = 30;

    // Alterner les couleurs de fond
    if (index % 2 === 0) {
      doc
        .rect(margin, y, tableWidth, rowHeight)
        .fillAndStroke("#ffffff", "#e2e8f0");
    } else {
      doc
        .rect(margin, y, tableWidth, rowHeight)
        .fillAndStroke("#f8fafc", "#e2e8f0");
    }

    doc
      .fillColor("#1e293b")
      .text(service.description, margin + 5, y + 8, {
        width: col1Width - 10,
        height: rowHeight - 16,
      })
      .text(service.quantity.toString(), margin + col1Width + 5, y + 8, {
        width: col2Width - 10,
      })
      .text(service.unit, margin + col1Width + col2Width + 5, y + 8, {
        width: col3Width - 10,
      })
      .text(
        `${service.unitPriceHT.toFixed(2)} €`,
        margin + col1Width + col2Width + col3Width + 5,
        y + 8,
        { width: col4Width - 10 },
      )
      .text(
        `${service.totalHT.toFixed(2)} €`,
        margin + col1Width + col2Width + col3Width + col4Width + 5,
        y + 8,
        { width: col5Width - 10 },
      );

    y += rowHeight;
  });

  doc.y = y + 10;
}

/**
 * Rendre les totaux
 */
function renderTotals(doc, totals) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width;
  const rightX = pageWidth - margin - 200;

  const startY = doc.y + 10;

  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Total HT:", rightX, startY, { width: 120, align: "left" })
    .text(`${totals.totalHT.toFixed(2)} €`, rightX + 120, startY, {
      width: 80,
      align: "right",
    });

  doc
    .text("TVA (0%):", rightX, startY + 20, { width: 120, align: "left" })
    .text(`${totals.VAT.toFixed(2)} €`, rightX + 120, startY + 20, {
      width: 80,
      align: "right",
    });

  // Total TTC en gras
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Total TTC:", rightX, startY + 45, { width: 120, align: "left" })
    .text(`${totals.totalTTC.toFixed(2)} €`, rightX + 120, startY + 45, {
      width: 80,
      align: "right",
    });

  // Mention TVA
  doc
    .fontSize(9)
    .font("Helvetica-Oblique")
    .fillColor("#64748b")
    .text("TVA non applicable, art. 293 B du CGI", margin, startY + 70, {
      align: "right",
      width: pageWidth - 2 * margin,
    });

  doc.fillColor("#1e293b");
  doc.y = startY + 100;
}

/**
 * Rendre le pied de page avec mentions légales
 */
function renderFooter(doc, config, type, document) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const footerTop = pageHeight - 180;

  // S'assurer qu'on est assez bas dans la page
  if (doc.y > footerTop - 20) {
    doc.addPage();
  } else {
    doc.y = footerTop;
  }

  // Ligne de séparation
  doc
    .moveTo(margin, doc.y)
    .lineTo(pageWidth - margin, doc.y)
    .strokeColor("#e2e8f0")
    .stroke();

  doc.moveDown(1);

  // Conditions de paiement (pour factures)
  if (type === "factures" && config.billing.paymentTerms) {
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("Conditions de paiement:", margin, doc.y)
      .font("Helvetica")
      .text(config.billing.paymentTerms, margin, doc.y + 12, {
        width: pageWidth - 2 * margin,
      });

    doc.moveDown(0.5);
  }

  // Pénalités de retard (pour factures)
  if (type === "factures" && config.billing.latePenalties) {
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#64748b")
      .text(config.billing.latePenalties, margin, doc.y, {
        width: pageWidth - 2 * margin,
      });

    doc.moveDown(0.5);
  }

  // Mention légale
  if (config.billing.legalNotice) {
    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(config.billing.legalNotice, margin, doc.y, {
        width: pageWidth - 2 * margin,
      });

    doc.moveDown(1);
  }

  // RIB si configuré
  if (config.rib.iban) {
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#1e293b")
      .text("Coordonnées bancaires:", margin, doc.y);

    doc
      .font("Helvetica")
      .fontSize(8)
      .text(`IBAN: ${config.rib.iban}`, margin, doc.y + 12);

    if (config.rib.bic) {
      doc.text(`BIC: ${config.rib.bic}`, margin, doc.y + 24);
    }

    if (config.rib.bank) {
      doc.text(
        `Banque: ${config.rib.bank}`,
        margin,
        doc.y + (config.rib.bic ? 36 : 24),
      );
    }
  }

  // Numéro de page
  doc
    .fontSize(8)
    .fillColor("#64748b")
    .text(`Page 1`, margin, pageHeight - 30, {
      align: "center",
      width: pageWidth - 2 * margin,
    });
}
