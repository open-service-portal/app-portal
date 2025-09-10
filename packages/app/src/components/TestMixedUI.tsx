import React from 'react';
// Old Backstage UI components (Material UI based)
import { Content, Header, Page, HeaderLabel } from '@backstage/core-components';
import { Grid as MuiGrid, Paper, Typography } from '@material-ui/core';

// New Backstage UI components (React Aria based)
import '@backstage/ui/css/styles.css';
import { 
  Box as NewBox, 
  Button as NewButton,
  Flex as NewFlex,
  Text as NewText,
  Switch as NewSwitch,
  SearchField as NewSearchField
} from '@backstage/ui';

export const TestMixedUI = () => {
  const [switchValue, setSwitchValue] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  return (
    <Page themeId="tool">
      {/* Old UI Header */}
      <Header title="Mixed UI Demo" subtitle="Combining old and new Backstage UI">
        <HeaderLabel label="Status" value="Experimental" />
      </Header>
      
      <Content>
        {/* Old MUI Grid */}
        <MuiGrid container spacing={3}>
          <MuiGrid item xs={12}>
            <Typography variant="h4">
              Testing Mixed UI Components
            </Typography>
            <Typography variant="body1" paragraph>
              This page demonstrates using both old Material UI components and new React Aria components together.
            </Typography>
          </MuiGrid>

          {/* Section 1: Old UI Paper with New UI content */}
          <MuiGrid item xs={12} md={6}>
            <Paper style={{ padding: '16px' }}>
              <Typography variant="h6" gutterBottom>
                Old Paper + New Components
              </Typography>
              
              {/* New UI components inside old Paper */}
              <NewBox mb="3">
                <NewText>This is new @backstage/ui Text inside an old MUI Paper</NewText>
              </NewBox>
              
              <NewFlex gap="2" direction="column">
                <NewButton>New Button</NewButton>
                <NewButton variant="primary">New Primary Button</NewButton>
              </NewFlex>
              
              <NewBox mt="3">
                <NewSwitch 
                  isSelected={switchValue}
                  onChange={setSwitchValue}
                >
                  New Switch Component
                </NewSwitch>
              </NewBox>
            </Paper>
          </MuiGrid>

          {/* Section 2: New UI Box with Old UI content */}
          <MuiGrid item xs={12} md={6}>
            <NewBox p="4" style={{ backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <NewText as="h2">New Box + Old Components</NewText>
              
              {/* Old MUI components inside new Box */}
              <Typography variant="body1" paragraph>
                This is old MUI Typography inside a new @backstage/ui Box
              </Typography>
              
              <Paper style={{ padding: '8px', marginTop: '16px' }}>
                <Typography variant="caption">
                  Nested: Old Paper inside New Box
                </Typography>
              </Paper>
            </NewBox>
          </MuiGrid>

          {/* Section 3: Side by side comparison */}
          <MuiGrid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Side-by-Side Comparison
            </Typography>
          </MuiGrid>

          <MuiGrid item xs={6}>
            <Paper style={{ padding: '16px' }}>
              <Typography variant="subtitle1" gutterBottom>
                Old Material UI
              </Typography>
              <input 
                type="text" 
                placeholder="Old HTML input"
                style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
              />
              <button style={{ padding: '8px 16px' }}>
                Old HTML Button
              </button>
            </Paper>
          </MuiGrid>

          <MuiGrid item xs={6}>
            <NewBox p="4" style={{ backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
              <NewText as="h3">New React Aria UI</NewText>
              <NewBox mt="2">
                <NewSearchField
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="New SearchField"
                />
              </NewBox>
              <NewBox mt="2">
                <NewButton>New Button</NewButton>
              </NewBox>
            </NewBox>
          </MuiGrid>

          {/* Info section */}
          <MuiGrid item xs={12}>
            <Paper style={{ padding: '16px', marginTop: '16px', backgroundColor: '#e3f2fd' }}>
              <Typography variant="h6" gutterBottom>
                Compatibility Notes
              </Typography>
              <Typography variant="body2" paragraph>
                ✅ Both UI libraries can coexist in the same page
              </Typography>
              <Typography variant="body2" paragraph>
                ✅ New components can be nested in old containers and vice versa
              </Typography>
              <Typography variant="body2" paragraph>
                ⚠️ Styling systems are different (MUI theme vs React Aria CSS)
              </Typography>
              <Typography variant="body2" paragraph>
                ⚠️ Form handling might need adapters between the two systems
              </Typography>
              <Typography variant="body2">
                📦 Old: @backstage/core-components + @material-ui/core
              </Typography>
              <Typography variant="body2">
                📦 New: @backstage/ui (React Aria Components)
              </Typography>
            </Paper>
          </MuiGrid>
        </MuiGrid>
      </Content>
    </Page>
  );
};