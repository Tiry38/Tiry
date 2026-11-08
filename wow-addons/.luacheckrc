-- luacheck-Konfiguration für Tiry's Zentrale (Lua 5.1, WoW: Forever 1.60.1)
std = "lua51"
max_line_length = false
exclude_files = { "tests/**", "tools/**" }
-- Absichtlich unbenutzte Parameter (Ereignis-Handler bekommen immer (event, ...)) nicht melden
unused_args = false

-- Globale Namen, die das Addon SCHREIBT (alles andere wäre ein Leck)
globals = {
  "TirysZentrale", "TirysZentraleDB", "TirysZentraleCharDB",
  "SLASH_TIRYSZENTRALE1", "SLASH_TIRYSZENTRALE2", "SLASH_TIRYSZENTRALE3", "SlashCmdList",
  "BINDING_HEADER_TIRYSZENTRALE", "BINDING_NAME_TIRYSZENTRALE_TOGGLE", "BINDING_NAME_TIRYSZENTRALE_SEARCH",
  "BINDING_NAME_TIRYSZENTRALE_SHOP", "BINDING_NAME_TIRYSZENTRALE_CRAFTNEXT",
  "TirysZentrale_OnAddonCompartmentClick", "TirysZentrale_OnAddonCompartmentEnter", "TirysZentrale_OnAddonCompartmentLeave",
}

-- WoW-API, die das Addon LIEST (geprüft gegen den Forever-Quellcode, siehe AUDIT.md)
read_globals = {
  -- Namensräume
  "C_AddOns", "C_AuctionHouse", "C_Bank", "C_Container", "C_Item", "C_Map", "C_MerchantFrame", "C_SkillInfo",
  "C_SpellBook", "C_SuperTrack", "C_Texture", "C_Timer", "C_TradeSkillUI", "Enum", "TooltipDataProcessor", "UiMapPoint",
  -- Funktionen
  "BuyMerchantItem", "CanMerchantRepair", "ChatEdit_InsertLink", "CreateColor", "CreateFrame", "GetCursorPosition",
  "GetInboxHeaderInfo", "GetInboxInvoiceInfo", "GetInboxItem", "GetInboxNumItems", "GetItemIcon", "GetItemInfo",
  "GetLocale", "GetMerchantItemID", "GetMerchantItemInfo", "GetMerchantItemMaxStack", "GetMerchantNumItems",
  "GetMoney", "GetMoneyString", "GetProfessionInfo", "GetProfessions", "GetRealZoneText", "GetRealmName",
  "GetRepairAllCost", "GetTime", "HandleModifiedItemClick", "InCombatLockdown", "IsShiftKeyDown", "OpenWorldMap",
  "PlaySound", "RepairAllItems", "UnitClass", "UnitFactionGroup", "UnitLevel", "UnitName", "date", "geterrorhandler",
  "strtrim", "time", "tinsert", "wipe", "seterrorhandler",
  -- Rahmen, Tabellen, Konstanten
  "Auctionator", "ChatFrameUtil", "DEFAULT_CHAT_FRAME", "GameFontNormal", "GameTooltip", "ItemRefTooltip",
  "MerchantFrame", "Minimap", "UIParent", "UISpecialFrames", "SOUNDKIT", "STANDARD_TEXT_FONT",
  "ATTACHMENTS_MAX_RECEIVE", "AUCTION_EXPIRED_MAIL_SUBJECT", "NUM_BAG_SLOTS", "NUM_TOTAL_EQUIPPED_BAG_SLOTS",
}
