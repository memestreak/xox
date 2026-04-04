import * as constants from '../app/constants';

test('constants snapshot', () => {
  expect(constants).toMatchSnapshot();
});
