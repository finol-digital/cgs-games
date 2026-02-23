import { NextResponse } from 'next/server';

export async function GET() {
  const silvieHost = 'https://silvie.gg';
  const url = new URL(`${silvieHost}/api/spoilers?set=34,35,36,37,38`);
  console.log('Request /api/gatcg_spoilers GET ' + url);
  const response = await fetch(url);
  const responseJson = await response.json();
  console.log(responseJson);
  const dataContainer: {
    data: {
      uuid: string;
      name: string;
      card_image_url: string;
      back_card_name: string;
      back_card_image_url: string;
      types: string[];
      element: string;
    }[];
  } = {
    data: [],
  };
  for (let i = 0; i < responseJson.spoilers.length; i++) {
    dataContainer.data.push({
      uuid: '',
      name: '',
      card_image_url: '',
      back_card_name: '',
      back_card_image_url: '',
      types: [],
      element: '',
    });
    dataContainer.data[i].uuid = '' + responseJson.spoilers[i].id;
    dataContainer.data[i].name = responseJson.spoilers[i].card_name;
    dataContainer.data[i].card_image_url = silvieHost + responseJson.spoilers[i].card_image_url.replace('/img/', '/api/images/');
    if (responseJson.spoilers[i].back_card && responseJson.spoilers[i].back_card.card_name) {
      dataContainer.data[i].back_card_name = responseJson.spoilers[i].back_card.card_name;
      dataContainer.data[i].back_card_image_url =
        silvieHost + responseJson.spoilers[i].back_card.card_image_url.replace('/img/', '/api/images/');
    }
    const cardType = responseJson.spoilers[i].card_type;
    if (typeof cardType === 'string') {
      dataContainer.data[i].types = [cardType.toUpperCase()];
    }
    const elementName = responseJson.spoilers[i].element_name;
    if (typeof elementName === 'string') {
      dataContainer.data[i].element = elementName.toUpperCase();
    }
  }
  console.log(dataContainer);
  return new NextResponse(JSON.stringify(dataContainer), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
