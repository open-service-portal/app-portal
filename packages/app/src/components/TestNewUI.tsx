import React from 'react';
import { Content, Header, Page } from '@backstage/core-components';

// Import CSS - required for styling
import '@backstage/ui/css/styles.css';

// Import only stable components from @backstage/ui
import { 
  Box, 
  Button, 
  ButtonIcon,
  ButtonLink,
  Container, 
  Flex, 
  Grid,
  Link,
  SearchField,
  Select,
  Switch,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Text,
  TextField,
  Tooltip
} from '@backstage/ui';

export const TestNewUI = () => {
  const [switchValue, setSwitchValue] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');
  const [searchValue, setSearchValue] = React.useState('');
  const [selectedTab, setSelectedTab] = React.useState('tab1');

  return (
    <Page themeId="tool">
      <Header title="Backstage UI (ex-Canon) - Stable Components Demo" />
      <Content>
        <Container>
          <Box mb="4">
            <Text as="h1">Stable Components from @backstage/ui v0.7.0</Text>
          </Box>
          
          <Box mb="6">
            <Text as="h2">Layout Components</Text>
            
            <Box mb="3">
              <Text as="h3">Container</Text>
              <Container>
                <Box p="3" style={{ backgroundColor: '#f5f5f5' }}>
                  This is content inside a Container
                </Box>
              </Container>
            </Box>

            <Box mb="3">
              <Text as="h3">Flex Layout</Text>
              <Flex gap="2" align="center">
                <Box p="2" style={{ backgroundColor: '#e3f2fd' }}>Item 1</Box>
                <Box p="2" style={{ backgroundColor: '#e8f5e9' }}>Item 2</Box>
                <Box p="2" style={{ backgroundColor: '#fff3e0' }}>Item 3</Box>
              </Flex>
            </Box>

            <Box mb="3">
              <Text as="h3">Grid Layout</Text>
              <Grid.Root columns="3" gap="2">
                <Grid.Item>
                  <Box p="2" style={{ backgroundColor: '#f3e5f5' }}>Grid 1</Box>
                </Grid.Item>
                <Grid.Item>
                  <Box p="2" style={{ backgroundColor: '#fce4ec' }}>Grid 2</Box>
                </Grid.Item>
                <Grid.Item>
                  <Box p="2" style={{ backgroundColor: '#e0f2f1' }}>Grid 3</Box>
                </Grid.Item>
              </Grid.Root>
            </Box>
          </Box>

          <Box mb="6">
            <Text as="h2">Form Components</Text>
            
            <Flex direction="column" gap="3">
              <Box>
                <Text as="h3">TextField</Text>
                <TextField 
                  value={textValue}
                  onChange={setTextValue}
                  placeholder="Enter some text..."
                />
              </Box>

              <Box>
                <Text as="h3">SearchField</Text>
                <SearchField
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search..."
                />
              </Box>

              <Box>
                <Text as="h3">Select</Text>
                <Select defaultSelectedKey="option1">
                  <Select.Trigger placeholder="Choose an option" />
                  <Select.Content>
                    <Select.Item key="option1">Option 1</Select.Item>
                    <Select.Item key="option2">Option 2</Select.Item>
                    <Select.Item key="option3">Option 3</Select.Item>
                  </Select.Content>
                </Select>
              </Box>

              <Box>
                <Text as="h3">Switch</Text>
                <Switch 
                  isSelected={switchValue}
                  onChange={setSwitchValue}
                >
                  Toggle me
                </Switch>
              </Box>
            </Flex>
          </Box>

          <Box mb="6">
            <Text as="h2">Navigation Components</Text>
            
            <Box mb="3">
              <Text as="h3">Buttons</Text>
              <Flex gap="2">
                <Button>Regular Button</Button>
                <Button variant="primary">Primary Button</Button>
                <ButtonLink href="https://backstage.io" target="_blank">
                  Button Link
                </ButtonLink>
              </Flex>
            </Box>

            <Box mb="3">
              <Text as="h3">Links</Text>
              <Flex gap="3">
                <Link href="https://backstage.io">External Link</Link>
                <Link to="/catalog">Internal Link</Link>
              </Flex>
            </Box>

            <Box mb="3">
              <Text as="h3">Tabs</Text>
              <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab}>
                <TabList>
                  <Tab key="tab1">Tab 1</Tab>
                  <Tab key="tab2">Tab 2</Tab>
                  <Tab key="tab3">Tab 3</Tab>
                </TabList>
                <TabPanel key="tab1">
                  <Box p="3">
                    <Text>Content for Tab 1</Text>
                  </Box>
                </TabPanel>
                <TabPanel key="tab2">
                  <Box p="3">
                    <Text>Content for Tab 2</Text>
                  </Box>
                </TabPanel>
                <TabPanel key="tab3">
                  <Box p="3">
                    <Text>Content for Tab 3</Text>
                  </Box>
                </TabPanel>
              </Tabs>
            </Box>
          </Box>

          <Box mb="6">
            <Text as="h2">Feedback Components</Text>
            
            <Box>
              <Text as="h3">Tooltip</Text>
              <Tooltip content="This is a helpful tooltip">
                <Button>Hover me for tooltip</Button>
              </Tooltip>
            </Box>
          </Box>

          <Box mt="6" p="4" style={{ backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
            <Text as="h3">Component Status</Text>
            <Text>These are all the stable components from @backstage/ui v0.7.0 (Alpha)</Text>
            <Text>The library uses React Aria Components instead of Material UI.</Text>
            <Text>Source: GitHub Issue #30856 - Backstage UI Roadmap</Text>
          </Box>
        </Container>
      </Content>
    </Page>
  );
};