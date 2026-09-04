-- Phase H6 — sauvegarde de l'historique de conversation Ask NAVI
-- (demandée explicitement, jusque-là purement en mémoire côté frontend).
-- Seuls les échanges réussis sont persistés — un échec est retentable,
-- ce n'est pas un historique à conserver.

CREATE TABLE "AskNaviConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AskNaviConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AskNaviMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskNaviMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AskNaviConversation_userId_idx" ON "AskNaviConversation"("userId");

CREATE INDEX "AskNaviMessage_conversationId_idx" ON "AskNaviMessage"("conversationId");

ALTER TABLE "AskNaviConversation" ADD CONSTRAINT "AskNaviConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AskNaviMessage" ADD CONSTRAINT "AskNaviMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AskNaviConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
