export interface Portfolio {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export interface PortfolioHotel {
  portfolioId: string;
  hotelId: string;
  addedAt: string;
}
