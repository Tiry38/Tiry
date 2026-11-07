-- Goldrausch – Seite "AH-Schule": Auktionshaus und Auctionator für Einsteiger
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C

local page = {
  title = "AH-Schule",
  subtitle = "Auktionshaus und Auctionator – einfach erklärt, ohne Fachchinesisch.",
  icon = "book", label = "AH-Schule", order = 7,
}

function page.build(self, content, width)
  local st = UI.Stack(content)
  for idx, section in ipairs(ns.BASICS) do
    local card = UI.Card(content, 18, C.card)
    card:SetWidth(width)
    local stripe = CreateFrame("Frame", nil, card)
    stripe:SetSize(5, 30)
    stripe:SetPoint("TOPLEFT", 0, -18)
    stripe.bg = UI.Round(stripe, 2, "ARTWORK", 0)
    stripe.bg:SetGradient(idx % 2 == 1 and UI.GRAD or UI.GRAD_COOL, 1)
    local title = UI.Text(card, 15, "bold", C.text)
    title:SetPoint("TOPLEFT", 22, -20)
    title:SetText(section.title)
    local y = 50
    for _, line in ipairs(section.lines) do
      local dot = card:CreateTexture(nil, "ARTWORK")
      dot:SetTexture(UI.TEX.circle)
      dot:SetSize(7, 7)
      dot:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], 1)
      dot:SetPoint("TOPLEFT", 24, -y - 6)
      local fs = UI.Para(card, 12, C.muted, width - 70)
      fs:SetPoint("TOPLEFT", 42, -y)
      fs:SetText(line)
      y = y + math.ceil(fs:GetStringHeight()) + 8
    end
    card:SetHeight(y + 12)
    st:Add(card, y + 12, 14)
  end
  st:Para("Hinweis: Blizzard hat für Forever keine offiziellen Zahlen zu AH-Anteil und Laufzeiten veröffentlicht. "
    .. "Goldrausch rechnet darum mit einstellbarem AH-Anteil und zeigt dir immer, worauf eine Zahl beruht.", 11, C.dim, 10)
  st:Finish()
end

UI.RegisterPage("basics", page)
