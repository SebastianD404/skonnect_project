"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUT = PUT;
exports.DELETE = DELETE;
var prisma_1 = require("@/lib/prisma");
var server_1 = require("next/server");
var server_2 = require("@/lib/supabase/server");
function PUT(req_1, _a) {
    return __awaiter(this, arguments, void 0, function (req, _b) {
        var id, supabase, user, appUser, _c, title, content, imageUrl, announcement, updated, error_1, errorMessage;
        var params = _b.params;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, params];
                case 1:
                    id = (_d.sent()).id;
                    return [4 /*yield*/, (0, server_2.createClient)()];
                case 2:
                    supabase = _d.sent();
                    return [4 /*yield*/, supabase.auth.getUser()];
                case 3:
                    user = (_d.sent()).data.user;
                    if (!user) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
                    }
                    return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                            where: { authId: user.id },
                            select: { id: true, role: true },
                        })];
                case 4:
                    appUser = _d.sent();
                    if (!appUser) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "User not found" }, { status: 404 })];
                    }
                    // Check if user is SK_OFFICIAL or SUPER_ADMIN
                    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Only SK officials can edit announcements" }, { status: 403 })];
                    }
                    return [4 /*yield*/, req.json()];
                case 5:
                    _c = _d.sent(), title = _c.title, content = _c.content, imageUrl = _c.imageUrl;
                    // Validate input
                    if (!(title === null || title === void 0 ? void 0 : title.trim()) || !(content === null || content === void 0 ? void 0 : content.trim())) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Title and content are required" }, { status: 400 })];
                    }
                    return [4 /*yield*/, prisma_1.prisma.announcement.findUnique({
                            where: { id: id },
                        })];
                case 6:
                    announcement = _d.sent();
                    if (!announcement) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Announcement not found" }, { status: 404 })];
                    }
                    return [4 /*yield*/, prisma_1.prisma.announcement.update({
                            where: { id: id },
                            data: {
                                title: title.trim(),
                                content: content.trim(),
                                imageUrl: imageUrl || null,
                                updatedAt: new Date(),
                            },
                            include: {
                                author: {
                                    select: {
                                        id: true,
                                        fullName: true,
                                        email: true,
                                    },
                                },
                            },
                        })];
                case 7:
                    updated = _d.sent();
                    return [2 /*return*/, server_1.NextResponse.json(updated)];
                case 8:
                    error_1 = _d.sent();
                    errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                    console.error("Failed to update announcement:", errorMessage, error_1);
                    return [2 /*return*/, server_1.NextResponse.json({ error: "Failed to update announcement", details: errorMessage }, { status: 500 })];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function DELETE(req_1, _a) {
    return __awaiter(this, arguments, void 0, function (req, _b) {
        var id, supabase, user, appUser, announcement, error_2, errorMessage;
        var params = _b.params;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, params];
                case 1:
                    id = (_c.sent()).id;
                    return [4 /*yield*/, (0, server_2.createClient)()];
                case 2:
                    supabase = _c.sent();
                    return [4 /*yield*/, supabase.auth.getUser()];
                case 3:
                    user = (_c.sent()).data.user;
                    if (!user) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
                    }
                    return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                            where: { authId: user.id },
                            select: { id: true, role: true },
                        })];
                case 4:
                    appUser = _c.sent();
                    if (!appUser) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "User not found" }, { status: 404 })];
                    }
                    // Check if user is SK_OFFICIAL or SUPER_ADMIN
                    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Only SK officials can delete announcements" }, { status: 403 })];
                    }
                    return [4 /*yield*/, prisma_1.prisma.announcement.findUnique({
                            where: { id: id },
                        })];
                case 5:
                    announcement = _c.sent();
                    if (!announcement) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: "Announcement not found" }, { status: 404 })];
                    }
                    // Delete announcement
                    return [4 /*yield*/, prisma_1.prisma.announcement.delete({
                            where: { id: id },
                        })];
                case 6:
                    // Delete announcement
                    _c.sent();
                    return [2 /*return*/, server_1.NextResponse.json({ success: true })];
                case 7:
                    error_2 = _c.sent();
                    errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                    console.error("Failed to delete announcement:", errorMessage, error_2);
                    return [2 /*return*/, server_1.NextResponse.json({ error: "Failed to delete announcement", details: errorMessage }, { status: 500 })];
                case 8: return [2 /*return*/];
            }
        });
    });
}
