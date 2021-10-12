import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Cancel, Save } from '@material-ui/icons';
import EditIcon from '@material-ui/icons/Edit';
import React, { useEffect, useState } from 'react';
import EmailDetails from './EmailDetails';
import { EmailTemplateType } from '../../models/emails/EmailModels';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '300px',
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  grid: {
    marginBottom: theme.spacing(3),
  },
  multiline: {
    width: '100%',
    marginBottom: theme.spacing(3),
  },
  textField: {
    width: '100%',
  },
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(2),
  },
}));

interface Props {
  handleCreate: (templateState: EmailTemplateType) => void;
  handleSave: (templateState: EmailTemplateType) => void;
  handleCancel: (id: string) => void;
  template: EmailTemplateType;
  value: number;
  index: number;
  edit: boolean;
  setEdit: (edit: boolean) => void;
  add: boolean;
  setAdd: (add: boolean) => void;
}

const TabPanel: React.FC<Props> = ({
  handleCreate,
  handleSave,
  handleCancel,
  template,
  value,
  index,
  edit,
  setEdit,
  add,
  setAdd,
}) => {
  const classes = useStyles();

  const [templateState, setTemplateState] = useState<EmailTemplateType>({
    _id: '',
    name: '',
    subject: '',
    body: '',
    variables: [],
  });

  useEffect(() => {
    setTemplateState({
      _id: template._id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });

    if (template._id === 'newTemplate_id') {
      setEdit(true);
    }
  }, [setEdit, template]);

  const handleEditClick = () => {
    setEdit(!edit);
  };

  const handleSaveClick = () => {
    if (templateState._id === 'newTemplate_id') {
      handleCreate(templateState);
    } else {
      handleSave(templateState);
    }
    setEdit(!edit);
  };

  const handleCancelClick = () => {
    if (handleCancel) {
      handleCancel(template._id);
    }
    setTemplateState({
      _id: template._id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });
  };

  if (value !== index) {
    return null;
  }

  return (
    <Container>
      <Box>
        <Grid container>
          <Grid item xs={10}>
            {edit ? (
              <TextField
                label={'Template name'}
                variant={'outlined'}
                value={templateState.name}
                onChange={(event) => {
                  setTemplateState({
                    ...templateState,
                    name: event.target.value,
                  });
                }}
              />
            ) : (
              <Typography variant="h6">{templateState.name}</Typography>
            )}
          </Grid>
          <Grid container item xs={2} justify={'flex-end'}>
            {!edit ? (
              <IconButton aria-label="edit" onClick={handleEditClick}>
                <EditIcon />
              </IconButton>
            ) : (
              <>
                <IconButton aria-label="cancel" onClick={handleCancelClick}>
                  <Cancel />
                </IconButton>
                <IconButton aria-label="save" onClick={handleSaveClick}>
                  <Save />
                </IconButton>
              </>
            )}
          </Grid>
        </Grid>
        <Divider className={classes.divider} />
        <EmailDetails
          edit={edit}
          add={add}
          setAdd={setAdd}
          templateState={templateState}
          setTemplateState={setTemplateState}
        />
      </Box>
    </Container>
  );
};

export default TabPanel;
