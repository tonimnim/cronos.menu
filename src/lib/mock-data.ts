// Placeholder data so the dev server renders before Supabase is wired.
// Replace with real queries in src/db once DATABASE_URL is set.

export type MockMenuItem = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  price: number;
  imageUrl: string | null;
  available: boolean;
};

export type MockCategory = {
  id: string;
  name: Record<string, string>;
  items: MockMenuItem[];
};

export type MockRestaurant = {
  slug: string;
  name: string;
  currency: string;
  categories: MockCategory[];
};

export const mockRestaurant: MockRestaurant = {
  slug: "demo",
  name: "Demo Bistro",
  currency: "USD",
  categories: [
    {
      id: "cat-starters",
      name: { en: "Starters", fr: "Entrées", es: "Entrantes", pt: "Entradas", zh: "开胃菜" },
      items: [
        {
          id: "item-samosa",
          name: { en: "Samosa", fr: "Samoussa", es: "Samosa", pt: "Samosa", zh: "咖喱角" },
          description: {
            en: "Crispy pastry with spiced beef filling",
            fr: "Pâtisserie croustillante à la viande épicée",
            es: "Empanadilla crujiente con relleno de carne especiada",
            pt: "Pastel crocante com recheio de carne temperada",
            zh: "酥脆香辣牛肉角",
          },
          price: 3.5,
          imageUrl: null,
          available: true,
        },
        {
          id: "item-soup",
          name: { en: "Tomato Soup", fr: "Soupe de tomate", es: "Sopa de tomate", pt: "Sopa de tomate", zh: "番茄汤" },
          description: {
            en: "Fresh roasted tomatoes with basil",
            fr: "Tomates fraîches rôties au basilic",
            es: "Tomates frescos asados con albahaca",
            pt: "Tomates frescos assados com manjericão",
            zh: "新鲜烤番茄配罗勒",
          },
          price: 4.0,
          imageUrl: null,
          available: true,
        },
      ],
    },
    {
      id: "cat-mains",
      name: { en: "Mains", fr: "Plats principaux", es: "Principales", pt: "Pratos principais", zh: "主菜" },
      items: [
        {
          id: "item-steak",
          name: {
            en: "Grilled Beef",
            fr: "Bœuf grillé",
            es: "Carne a la parrilla",
            pt: "Carne grelhada",
            zh: "烤牛肉",
          },
          description: {
            en: "Flame-grilled beef, served with fresh salsa",
            fr: "Bœuf grillé à la flamme, servi avec salsa fraîche",
            es: "Carne a la parrilla, servida con salsa fresca",
            pt: "Carne grelhada na chama, servida com salsa fresca",
            zh: "炭火烤牛肉,配新鲜莎莎酱",
          },
          price: 12.0,
          imageUrl: null,
          available: true,
        },
        {
          id: "item-pizza",
          name: { en: "Margherita Pizza", fr: "Pizza Margherita", es: "Pizza Margherita", pt: "Pizza Margherita", zh: "玛格丽特披萨" },
          description: {
            en: "Tomato, mozzarella, fresh basil",
            fr: "Tomate, mozzarella, basilic frais",
            es: "Tomate, mozzarella, albahaca fresca",
            pt: "Tomate, mussarela, manjericão fresco",
            zh: "番茄、马苏里拉、新鲜罗勒",
          },
          price: 10.0,
          imageUrl: null,
          available: true,
        },
      ],
    },
    {
      id: "cat-drinks",
      name: { en: "Drinks", fr: "Boissons", es: "Bebidas", pt: "Bebidas", zh: "饮品" },
      items: [
        {
          id: "item-chai",
          name: { en: "Masala Chai", fr: "Thé masala", es: "Té masala", pt: "Chá masala", zh: "马萨拉茶" },
          description: { en: "Spiced milk tea", fr: "Thé au lait épicé", es: "Té con leche especiado", pt: "Chá de leite com especiarias", zh: "香料奶茶" },
          price: 2.0,
          imageUrl: null,
          available: true,
        },
      ],
    },
  ],
};
