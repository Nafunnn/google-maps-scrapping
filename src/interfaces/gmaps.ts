export interface IDetailInfo {
  name: string;
  website: string | undefined;
  category: string;
  address: string;
  phone: string;
  googleUrl: string | undefined;
  ratingText: string | undefined;
}

export interface IQuery {
  tampungHasil: IDetailInfo[];
  query: string;
}
