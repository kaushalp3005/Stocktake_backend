"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupBox = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * GET /api/boxes/lookup?box_id=X&txn_no=Y
 *
 * Looks up a box by its box_id (and optionally txn_no) across
 * cdpl_boxes_v2 / cfpl_boxes_v2 and JOINs with the corresponding
 * articles table to return full item details for StockTake form pre-fill.
 *
 * Returns:
 *   { boxId, txnNo, itemName, itemType, category, subcategory, unitUom, source }
 */
const lookupBox = async (req, res) => {
    const rawBoxId = (req.query.box_id || "").trim();
    const rawTxnNo = (req.query.txn_no || "").trim();
    if (!rawBoxId) {
        res.status(400).json({ error: "box_id query parameter is required" });
        return;
    }
    try {
        // ── BE-prefix routing: bulk entry tables only ────────────────────
        // When transaction_no starts with "BE", look up exclusively in
        // cfpl_bulk_entry_boxes → cdpl_bulk_entry_boxes. No fallback to v2.
        // Bulk entry rows don't carry category/subcategory/material_type;
        // the frontend reverse-fills those from article_description.
        if (rawTxnNo.toUpperCase().startsWith("BE")) {
            const buildBulkQuery = (table) => `
        SELECT
          box_id,
          transaction_no,
          article_description,
          net_weight
        FROM "${table}"
        WHERE box_id = $1
          AND transaction_no = $2
        LIMIT 1
      `;
            const bulkParams = [rawBoxId, rawTxnNo];
            let bulkRows = await prisma.$queryRawUnsafe(buildBulkQuery("cfpl_bulk_entry_boxes"), ...bulkParams);
            let bulkSource = "CFPL";
            if (!bulkRows || bulkRows.length === 0) {
                bulkRows = await prisma.$queryRawUnsafe(buildBulkQuery("cdpl_bulk_entry_boxes"), ...bulkParams);
                bulkSource = "CDPL";
            }
            if (!bulkRows || bulkRows.length === 0) {
                res.status(404).json({
                    error: `Box "${rawBoxId}" / TXN "${rawTxnNo}" not found in bulk entry records.`,
                });
                return;
            }
            const bulkRow = bulkRows[0];
            const bulkItemName = (bulkRow.article_description || "").toString().toUpperCase().trim() ||
                `UNKNOWN (${rawBoxId})`;
            const bulkUnitUom = parseFloat(bulkRow.net_weight) || 0;
            res.json({
                boxId: bulkRow.box_id,
                txnNo: bulkRow.transaction_no,
                itemName: bulkItemName,
                itemType: "",
                category: "",
                subcategory: "",
                unitUom: bulkUnitUom,
                source: bulkSource,
            });
            return;
        }
        // ── Build the lookup SQL for one company prefix ──────────────────
        // We try CDPL first, then CFPL.
        // The boxes table has article_description (may be empty).
        // When it's set we match articles by both txn_no + item_description.
        // When it's empty we return the first article for the transaction.
        const buildQuery = (boxTable, articleTable) => `
      SELECT
        b.box_id,
        b.transaction_no,
        b.article_description   AS box_article,
        b.net_weight            AS box_net_weight,
        a.item_description,
        a.item_category,
        a.sub_category,
        a.material_type,
        a.net_weight            AS article_net_weight,
        a.uom
      FROM "${boxTable}" b
      LEFT JOIN "${articleTable}" a
        ON  a.transaction_no = b.transaction_no
        AND (
              COALESCE(b.article_description, '') = ''
          OR  a.item_description = b.article_description
            )
      WHERE b.box_id = $1
        ${rawTxnNo ? "AND b.transaction_no = $2" : ""}
      LIMIT 1
    `;
        // Helper: run a raw query with optional txn_no param
        const runQuery = async (boxTable, articleTable) => {
            const params = rawTxnNo ? [rawBoxId, rawTxnNo] : [rawBoxId];
            const sql = buildQuery(boxTable, articleTable);
            const result = await prisma.$queryRawUnsafe(sql, ...params);
            return result;
        };
        // Try CDPL first, then CFPL
        let rows = await runQuery("cdpl_boxes_v2", "cdpl_articles_v2");
        let source = "CDPL";
        if (!rows || rows.length === 0) {
            rows = await runQuery("cfpl_boxes_v2", "cfpl_articles_v2");
            source = "CFPL";
        }
        if (!rows || rows.length === 0) {
            res.status(404).json({
                error: `Box "${rawBoxId}"${rawTxnNo ? ` / TXN "${rawTxnNo}"` : ""} not found in CDPL or CFPL records.`,
            });
            return;
        }
        const row = rows[0];
        // Resolve item name: prefer articles.item_description, fall back to box.article_description
        const itemName = (row.item_description || row.box_article || "").toString().toUpperCase().trim() ||
            `UNKNOWN (${rawBoxId})`;
        // Resolve UOM: box net_weight is per-box; article net_weight is per-unit
        // Use box net_weight as the per-unit weight for stock-take purposes
        const unitUom = parseFloat(row.box_net_weight) ||
            parseFloat(row.article_net_weight) ||
            0;
        // Normalise material_type to FG / RM / PM
        const rawType = (row.material_type || "").toString().toUpperCase().trim();
        const itemType = ["FG", "RM", "PM"].includes(rawType) ? rawType : rawType || "FG";
        const category = (row.item_category || "").toString().toUpperCase().trim();
        const subcategory = (row.sub_category || "").toString().toUpperCase().trim();
        res.json({
            boxId: row.box_id,
            txnNo: row.transaction_no,
            itemName,
            itemType,
            category,
            subcategory,
            unitUom,
            source, // "CDPL" | "CFPL"
        });
    }
    catch (err) {
        console.error("[boxes/lookup] DB error:", err);
        res.status(500).json({ error: "Database error while looking up box. Please try again." });
    }
};
exports.lookupBox = lookupBox;
