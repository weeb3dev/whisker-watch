// Seed fixtures, used when a live scrape fails or returns nothing.
// PetSmart in-store adoptions have no per-cat public pages, so PetSmart
// fixtures link to the PetSmart Charities adoption finder.
export type RawListing = {
  externalId: string;
  name: string;
  url: string;
  breed: string;
  age: string;
  zip: string;
  photoUrl?: string;
};

export const FIXTURES: Record<"petsmart" | "petfinder", RawListing[]> = {
  petsmart: [
    {
      externalId: "psc-fx-001",
      name: "Mochi",
      url: "https://www.petsmartcharities.org/adopt-a-pet",
      breed: "Domestic Long Hair",
      age: "Kitten",
      zip: "94103",
      photoUrl: "https://placecats.com/millie/320/220",
    },
    {
      externalId: "psc-fx-002",
      name: "Biscuit",
      url: "https://www.petsmartcharities.org/adopt-a-pet",
      breed: "Domestic Short Hair & Tabby",
      age: "Adult",
      zip: "94612",
      photoUrl: "https://placecats.com/neo/320/220",
    },
    {
      externalId: "psc-fx-003",
      name: "Nimbus",
      url: "https://www.petsmartcharities.org/adopt-a-pet",
      breed: "Maine Coon Mix",
      age: "Young",
      zip: "94301",
      photoUrl: "https://placecats.com/bella/320/220",
    },
    {
      externalId: "psc-fx-004",
      name: "Pixel",
      url: "https://www.petsmartcharities.org/adopt-a-pet",
      breed: "Domestic Medium Hair",
      age: "Senior",
      zip: "95112",
      photoUrl: "https://placecats.com/g/320/220",
    },
    {
      externalId: "psc-fx-005",
      name: "Saturn",
      url: "https://www.petsmartcharities.org/adopt-a-pet",
      breed: "Sphynx",
      age: "Adult",
      zip: "90012",
      photoUrl: "https://placecats.com/poppy/320/220",
    },
  ],
  petfinder: [
    {
      externalId: "pf-fx-101",
      name: "Clementine",
      url: "https://www.petfinder.com/search/cats-for-adoption/us/ca/94103/",
      breed: "Domestic Long Hair",
      age: "Young",
      zip: "94103",
      photoUrl: "https://placecats.com/louie/320/220",
    },
    {
      externalId: "pf-fx-102",
      name: "Orbit",
      url: "https://www.petfinder.com/search/cats-for-adoption/us/ca/94103/",
      breed: "Russian Blue",
      age: "Adult",
      zip: "94110",
      photoUrl: "https://placecats.com/millie_neo/320/220",
    },
    {
      externalId: "pf-fx-103",
      name: "Waffles",
      url: "https://www.petfinder.com/search/cats-for-adoption/us/ca/94103/",
      breed: "Ragdoll Mix",
      age: "Kitten",
      zip: "94612",
      photoUrl: "https://placecats.com/neo_2/320/220",
    },
    {
      externalId: "pf-fx-104",
      name: "Juniper",
      url: "https://www.petfinder.com/search/cats-for-adoption/us/ca/94103/",
      breed: "Domestic Short Hair",
      age: "Senior",
      zip: "98101",
      photoUrl: "https://placecats.com/bella_2/320/220",
    },
  ],
};
