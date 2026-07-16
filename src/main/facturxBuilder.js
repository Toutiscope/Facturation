/**
 * Assembleur Factur-X.
 *
 * Produit un PDF/A-3 (couche visuelle = notre rendu PDFKit) avec le XML CII
 * embarqué et les métadonnées XMP Factur-X. Ce module est volontairement
 * « pur » : il reçoit le XML CII déjà généré et ne dépend pas de la couche PDP,
 * ce qui évite toute dépendance circulaire avec `einvoiceApi`.
 *
 * Chaîne de dépendances : einvoiceApi → facturxBuilder → pdfGenerator.
 */

import { buildPdfBuffer } from "./pdfGenerator.js";

const FACTURX_NS = "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#";
const EMBEDDED_XML_NAME = "factur-x.xml";
const FACTURX_VERSION = "1.0";

/**
 * Construit le bloc XMP Factur-X : déclaration de l'extension schema PDF/A
 * (obligatoire pour rester conforme PDF/A-3 avec un namespace custom) + les
 * métadonnées Factur-X elles-mêmes.
 *
 * @param {Object} params
 * @param {string} params.conformanceLevel - profil Factur-X (ex: "EN 16931")
 * @returns {string} fragment RDF à insérer dans le XMP du PDF
 */
function buildFacturxXmp({ conformanceLevel }) {
  return `
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
  <pdfaExtension:schemas>
    <rdf:Bag>
      <rdf:li rdf:parseType="Resource">
        <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
        <pdfaSchema:namespaceURI>${FACTURX_NS}</pdfaSchema:namespaceURI>
        <pdfaSchema:prefix>fx</pdfaSchema:prefix>
        <pdfaSchema:property>
          <rdf:Seq>
            <rdf:li rdf:parseType="Resource">
              <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
              <pdfaProperty:valueType>Text</pdfaProperty:valueType>
              <pdfaProperty:category>external</pdfaProperty:category>
              <pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description>
            </rdf:li>
            <rdf:li rdf:parseType="Resource">
              <pdfaProperty:name>DocumentType</pdfaProperty:name>
              <pdfaProperty:valueType>Text</pdfaProperty:valueType>
              <pdfaProperty:category>external</pdfaProperty:category>
              <pdfaProperty:description>INVOICE</pdfaProperty:description>
            </rdf:li>
            <rdf:li rdf:parseType="Resource">
              <pdfaProperty:name>Version</pdfaProperty:name>
              <pdfaProperty:valueType>Text</pdfaProperty:valueType>
              <pdfaProperty:category>external</pdfaProperty:category>
              <pdfaProperty:description>version of the Factur-X standard</pdfaProperty:description>
            </rdf:li>
            <rdf:li rdf:parseType="Resource">
              <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
              <pdfaProperty:valueType>Text</pdfaProperty:valueType>
              <pdfaProperty:category>external</pdfaProperty:category>
              <pdfaProperty:description>conformance level of the Factur-X data</pdfaProperty:description>
            </rdf:li>
          </rdf:Seq>
        </pdfaSchema:property>
      </rdf:li>
    </rdf:Bag>
  </pdfaExtension:schemas>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="${FACTURX_NS}">
  <fx:DocumentType>INVOICE</fx:DocumentType>
  <fx:DocumentFileName>${EMBEDDED_XML_NAME}</fx:DocumentFileName>
  <fx:Version>${FACTURX_VERSION}</fx:Version>
  <fx:ConformanceLevel>${conformanceLevel}</fx:ConformanceLevel>
</rdf:Description>
`;
}

/**
 * Assemble un Factur-X à partir d'une facture locale et de son XML CII.
 *
 * @param {Object} params
 * @param {Object} params.document - facture au format local (cf. CLAUDE.md)
 * @param {Object} params.config - configuration utilisateur
 * @param {string} params.ciiXml - XML CII (EN16931) déjà généré
 * @param {string} [params.type] - 'factures' par défaut (un Factur-X est une facture)
 * @param {string} [params.conformanceLevel] - profil Factur-X ("EN 16931" par défaut)
 * @returns {Promise<Buffer>} PDF/A-3 Factur-X
 */
export async function assembleFacturX({
  document,
  config,
  ciiXml,
  type = "factures",
  conformanceLevel = "EN 16931",
}) {
  if (!ciiXml || typeof ciiXml !== "string") {
    throw new Error("ciiXml requis pour assembler le Factur-X");
  }

  const xmlBuffer = Buffer.from(ciiXml, "utf8");
  const xmp = buildFacturxXmp({ conformanceLevel });

  return buildPdfBuffer(type, document, config, {
    docOptions: { subset: "PDF/A-3b", pdfVersion: "1.7", tagged: true },
    decorate(doc) {
      // Le XMP doit être injecté avant doc.end() (moment où le flux Metadata
      // est écrit). L'ordre XMP puis fichier embarqué reproduit le spike validé.
      doc.appendXML(xmp);
      doc.file(xmlBuffer, {
        name: EMBEDDED_XML_NAME,
        type: "text/xml",
        relationship: "Alternative",
        description: "Factur-X XML invoice",
      });
    },
  });
}
