const clientService = require("../services/client.service");
const { success } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const client = await clientService.createClient(req.body);
  return success(res, 201, "Client created", { client });
});

const list = asyncHandler(async (req, res) => {
  const result = await clientService.listClients(req.query);
  return success(res, 200, "Clients retrieved", result);
});

const getById = asyncHandler(async (req, res) => {
  const client = await clientService.getClientById(req.params.id);
  return success(res, 200, "Client retrieved", { client });
});

const update = asyncHandler(async (req, res) => {
  const client = await clientService.updateClient(req.params.id, req.body);
  return success(res, 200, "Client updated", { client });
});

const updateNotes = asyncHandler(async (req, res) => {
  const client = await clientService.updateCrmNotes(req.params.id, req.body.crmNotes);
  return success(res, 200, "CRM notes updated", { client });
});

const updateFollowUp = asyncHandler(async (req, res) => {
  const client = await clientService.updateFollowUpDate(
    req.params.id,
    req.body.nextFollowUpDate
  );
  return success(res, 200, "Follow-up date updated", { client });
});

const remove = asyncHandler(async (req, res) => {
  const result = await clientService.softDeleteClient(req.params.id, req.auth.adminId);
  return success(res, 200, "Client moved to recycle bin", { client: result });
});

const listCommunications = asyncHandler(async (req, res) => {
  const result = await clientService.listCommunications(req.params.id);
  return success(res, 200, "Communication log retrieved", result);
});

const addCommunication = asyncHandler(async (req, res) => {
  const communication = await clientService.addCommunication(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "Communication log entry added", { communication });
});

const listKyc = asyncHandler(async (req, res) => {
  const result = await clientService.listKycDocuments(req.params.id);
  return success(res, 200, "KYC documents retrieved", result);
});

const addKyc = asyncHandler(async (req, res) => {
  const document = await clientService.addKycDocument(
    req.params.id,
    req.body,
    req.auth.adminId
  );
  return success(res, 201, "KYC document registered", { document });
});

const uploadKyc = asyncHandler(async (req, res) => {
  const { moveToEntityFolder } = require("../utils/upload");
  const meta = moveToEntityFolder(req.file, [
    "clients",
    String(req.params.id),
    "kyc",
  ]);
  const document = await clientService.addKycDocument(
    req.params.id,
    {
      documentType: req.body.documentType || "KYC",
      filePath: meta.filePath,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      expiryDate: req.body.expiryDate || null,
    },
    req.auth.adminId
  );
  return success(res, 201, "KYC document uploaded", { document });
});

const removeKyc = asyncHandler(async (req, res) => {
  const result = await clientService.softDeleteKycDocument(
    req.params.id,
    req.params.documentId,
    req.auth.adminId
  );
  return success(res, 200, "KYC document moved to recycle bin", { document: result });
});

module.exports = {
  create,
  list,
  getById,
  update,
  updateNotes,
  updateFollowUp,
  remove,
  listCommunications,
  addCommunication,
  listKyc,
  addKyc,
  uploadKyc,
  removeKyc,
};
